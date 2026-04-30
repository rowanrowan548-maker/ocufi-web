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
    signature: sig,
    timestamp: ts,
    inputMint: side === 'buy' ? SOL_MINT : FAKE_USDC,
    outputMint: side === 'buy' ? FAKE_USDC : SOL_MINT,
    inputAmount: '1000000',
    quoteOutAmount: '99000000',
    slippageBps: 100,
    side,
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
