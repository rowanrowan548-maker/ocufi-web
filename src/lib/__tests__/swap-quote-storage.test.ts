/**
 * T-ONCHAIN-QUOTE-PERSIST · swap-quote-storage 单测
 *
 * 测点:
 *   - save / load 往返(buy + sell · 两种 side)
 *   - 找不到返 null(老交易 / 跨设备)
 *   - 损坏 JSON 返 null · 不抛
 *   - prune 30 天前的条目 · 同时清 quote key
 *   - 索引 1000 条上限自动裁剪最旧
 *   - SSR(无 window)安全 · 不抛
 *   - 同 sig 覆盖写不重复 index
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSwapQuote,
  loadSwapQuote,
  pruneOldQuotes,
  type StoredSwapQuote,
} from '@/lib/swap-quote-storage';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const FAKE_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function fakeQuote(sig: string, ts: number, side: 'buy' | 'sell'): StoredSwapQuote {
  return {
    version: 2,
    signature: sig,
    timestamp: ts,
    inputMint: side === 'buy' ? SOL_MINT : FAKE_USDC,
    outputMint: side === 'buy' ? FAKE_USDC : SOL_MINT,
    inputAmount: '1000000',
    quoteOutAmount: '99000000',
    slippageBps: 100,
    side,
    inputDecimals: side === 'buy' ? 9 : 6,
    quoteOutDecimals: side === 'buy' ? 6 : 9,
  };
}

beforeEach(() => {
  // 单测用 jsdom 环境 · 每 case 清 storage
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

describe('saveSwapQuote / loadSwapQuote · 往返', () => {
  it('save 后 load 返完整字段(buy)', () => {
    const q = fakeQuote('sig-buy-1', 1700000000000, 'buy');
    saveSwapQuote(q);
    const loaded = loadSwapQuote('sig-buy-1');
    expect(loaded).toEqual(q);
  });

  it('save 后 load 返完整字段(sell)', () => {
    const q = fakeQuote('sig-sell-1', 1700000000000, 'sell');
    saveSwapQuote(q);
    const loaded = loadSwapQuote('sig-sell-1');
    expect(loaded).toEqual(q);
  });

  it('未保存的 sig → 返 null', () => {
    expect(loadSwapQuote('non-existent-sig')).toBeNull();
  });

  it('空 sig → 返 null(防御性 · 不读 storage)', () => {
    expect(loadSwapQuote('')).toBeNull();
  });
});

describe('saveSwapQuote · 防御性', () => {
  it('空 sig → 静默不写 · load 后返 null', () => {
    const bad = { ...fakeQuote('', Date.now(), 'buy') };
    saveSwapQuote(bad);
    expect(loadSwapQuote('')).toBeNull();
  });

  it('损坏 JSON 在 storage 里 → load 返 null 不抛', () => {
    window.localStorage.setItem('ocufi:quote:corrupt', '{not-json[');
    expect(loadSwapQuote('corrupt')).toBeNull();
  });

  it('shape 不对(缺字段)→ load 返 null', () => {
    window.localStorage.setItem(
      'ocufi:quote:shape-bad',
      JSON.stringify({ signature: 'shape-bad', timestamp: 123 })
    );
    expect(loadSwapQuote('shape-bad')).toBeNull();
  });

  it('side 字段非 buy/sell → load 返 null', () => {
    const bad = { ...fakeQuote('sig-bad-side', Date.now(), 'buy'), side: 'transfer' };
    window.localStorage.setItem('ocufi:quote:sig-bad-side', JSON.stringify(bad));
    expect(loadSwapQuote('sig-bad-side')).toBeNull();
  });
});

describe('saveSwapQuote · 同 sig 覆盖写不重复 index', () => {
  it('同 sig 写两次 · 索引仅 1 条', () => {
    saveSwapQuote(fakeQuote('sig-dup', 1700000000000, 'buy'));
    saveSwapQuote(fakeQuote('sig-dup', 1700000000001, 'buy'));
    const rawIdx = window.localStorage.getItem('ocufi:quote-index');
    expect(rawIdx).not.toBeNull();
    const idx = JSON.parse(rawIdx!);
    expect(idx.filter((e: { signature: string }) => e.signature === 'sig-dup')).toHaveLength(1);
  });
});

describe('pruneOldQuotes · 30 天前清理', () => {
  const NOW = Date.now();
  const DAY = 24 * 3600 * 1000;

  it('保留 30 天内 · 清 30 天外 · 同时删 quote key', () => {
    saveSwapQuote(fakeQuote('sig-fresh', NOW - 5 * DAY, 'buy')); // 5 天前 · 留
    saveSwapQuote(fakeQuote('sig-old', NOW - 35 * DAY, 'sell')); // 35 天前 · 删
    saveSwapQuote(fakeQuote('sig-edge', NOW - 29 * DAY, 'buy')); // 29 天前 · 留

    pruneOldQuotes();

    expect(loadSwapQuote('sig-fresh')).not.toBeNull();
    expect(loadSwapQuote('sig-edge')).not.toBeNull();
    expect(loadSwapQuote('sig-old')).toBeNull();
    // quote key 被删
    expect(window.localStorage.getItem('ocufi:quote:sig-old')).toBeNull();
  });

  it('全部都新 → prune 不删任何东西', () => {
    saveSwapQuote(fakeQuote('sig-a', NOW - 1 * DAY, 'buy'));
    saveSwapQuote(fakeQuote('sig-b', NOW - 2 * DAY, 'sell'));
    pruneOldQuotes();
    expect(loadSwapQuote('sig-a')).not.toBeNull();
    expect(loadSwapQuote('sig-b')).not.toBeNull();
  });

  it('索引空 → prune 不抛', () => {
    expect(() => pruneOldQuotes()).not.toThrow();
  });

  it('索引坏 JSON → prune 不抛', () => {
    window.localStorage.setItem('ocufi:quote-index', '{broken[');
    expect(() => pruneOldQuotes()).not.toThrow();
  });
});

describe('saveSwapQuote · 1000 条上限自动裁剪', () => {
  it('写 1005 条不同 sig · 索引 ≤ 1000 · 最旧 5 条 quote key 被删', () => {
    const NOW = Date.now();
    for (let i = 0; i < 1005; i++) {
      saveSwapQuote(fakeQuote(`sig-${i}`, NOW - (1005 - i) * 1000, 'buy'));
    }
    const rawIdx = window.localStorage.getItem('ocufi:quote-index');
    const idx = JSON.parse(rawIdx!);
    expect(idx.length).toBeLessThanOrEqual(1000);
    // 最早的 5 条应已被删
    expect(loadSwapQuote('sig-0')).toBeNull();
    expect(loadSwapQuote('sig-4')).toBeNull();
    // 最新的应该在
    expect(loadSwapQuote('sig-1004')).not.toBeNull();
  });
});

describe('真实使用 · /history 滑点列接力', () => {
  it('saveSwapQuote 后 /history loadSwapQuote 拿到 quoteOutAmount(供算 realized bps)', () => {
    saveSwapQuote(fakeQuote('history-test-sig', Date.now(), 'buy'));
    const loaded = loadSwapQuote('history-test-sig');
    expect(loaded?.quoteOutAmount).toBe('99000000');
    // /history 算法预演:realized_bps = (quote_out - actual) / quote_out * 10000
    const actual = BigInt(98000000); // 假设链上实际收到
    const quoteOut = BigInt(loaded!.quoteOutAmount);
    const realized = Number(((quoteOut - actual) * BigInt(10000)) / quoteOut);
    expect(realized).toBeCloseTo(101, 0); // 约 1.01% 滑点
  });
});

/**
 * T-ONCHAIN-QUOTE-DECIMALS · v1 → v2 迁移 + decimals 字段校验
 *
 * 关键覆盖:
 *   - v1 旧条目(无 version + 无 decimals)→ load 返 null · /history 显 dash
 *   - v2 写入返 decimals 字段 · BUY 行算滑点用
 *   - decimals 字段类型不对 → 返 null
 *   - saveSwapQuote 强制写 version=2(防上游漏写)
 */
describe('T-ONCHAIN-QUOTE-DECIMALS · 版本 + decimals 字段', () => {
  it('saveSwapQuote 写出含 inputDecimals / quoteOutDecimals / version=2', () => {
    const q = fakeQuote('sig-v2-1', Date.now(), 'buy');
    saveSwapQuote(q);
    const loaded = loadSwapQuote('sig-v2-1');
    expect(loaded?.version).toBe(2);
    expect(loaded?.inputDecimals).toBe(9); // SOL
    expect(loaded?.quoteOutDecimals).toBe(6); // USDC
  });

  it('v1 旧条目(无 version 字段)→ load 返 null(SPEC 要求 · /history 显 dash 不爆错)', () => {
    const v1Entry = {
      signature: 'sig-v1-old',
      timestamp: Date.now(),
      inputMint: SOL_MINT,
      outputMint: FAKE_USDC,
      inputAmount: '1000000',
      quoteOutAmount: '99000000',
      slippageBps: 100,
      side: 'buy',
      // 注意:无 version · 无 inputDecimals · 无 quoteOutDecimals(模拟 v1 已存的旧条目)
    };
    window.localStorage.setItem('ocufi:quote:sig-v1-old', JSON.stringify(v1Entry));
    expect(loadSwapQuote('sig-v1-old')).toBeNull();
  });

  it('version=1 显式标记(老 ship 的旧版)→ load 返 null', () => {
    const v1Entry = {
      version: 1,
      signature: 'sig-v1-marked',
      timestamp: Date.now(),
      inputMint: SOL_MINT,
      outputMint: FAKE_USDC,
      inputAmount: '1000000',
      quoteOutAmount: '99000000',
      slippageBps: 100,
      side: 'buy',
    };
    window.localStorage.setItem('ocufi:quote:sig-v1-marked', JSON.stringify(v1Entry));
    expect(loadSwapQuote('sig-v1-marked')).toBeNull();
  });

  it('inputDecimals 字段类型不对(string)→ load 返 null', () => {
    const bad = { ...fakeQuote('sig-bad-dec', Date.now(), 'buy'), inputDecimals: '9' as unknown as number };
    window.localStorage.setItem('ocufi:quote:sig-bad-dec', JSON.stringify(bad));
    expect(loadSwapQuote('sig-bad-dec')).toBeNull();
  });

  it('quoteOutDecimals 字段缺失 → load 返 null', () => {
    const bad: Partial<StoredSwapQuote> = { ...fakeQuote('sig-no-out-dec', Date.now(), 'buy') };
    delete bad.quoteOutDecimals;
    window.localStorage.setItem('ocufi:quote:sig-no-out-dec', JSON.stringify(bad));
    expect(loadSwapQuote('sig-no-out-dec')).toBeNull();
  });

  it('调用方传 version=1 → save 强制覆盖为 2(防上游漏写)', () => {
    const sneaky = { ...fakeQuote('sig-sneaky-v1', Date.now(), 'buy'), version: 1 };
    saveSwapQuote(sneaky);
    const loaded = loadSwapQuote('sig-sneaky-v1');
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(2);
  });

  it('BUY 行 decimals 算法预演(SOL→USDC · quoteOut 6 decimals)', () => {
    saveSwapQuote(fakeQuote('sig-buy-decimals', Date.now(), 'buy'));
    const loaded = loadSwapQuote('sig-buy-decimals');
    expect(loaded?.quoteOutDecimals).toBe(6);
    // /history BUY 算法:把 quoteOutAmount 从 raw 转成 ui · 跟实际 token 量对比
    const quoteOutUi = Number(loaded!.quoteOutAmount) / 10 ** loaded!.quoteOutDecimals;
    expect(quoteOutUi).toBe(99); // 99 USDC
  });
});
