// @vitest-environment node
// 用 node 环境跑 · jsdom 的 Buffer polyfill 跟 @solana/buffer-layout(SystemProgram.transfer)
// 不兼容 → "b must be a Uint8Array"。本文件纯 lib 单测,不需要 jsdom DOM API。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import {
  getFeeBps,
  buildFeeMemoText,
  compileV0Tx,
  assertSafeSize,
  buildFeeTransferOnly,
  PHANTOM_SAFE_SIZE_LIMIT,
  SOLANA_TX_SIZE_LIMIT,
} from '@/lib/swap-with-fee';

/**
 * T-FEE-CONFIG-onchain · feeBps env 驱动测试
 *
 * 4 case 覆盖:
 *   1. buy + ENV_BUY=10(默认)→ 收 0.1% buy fee
 *   2. sell + ENV_SELL=0(默认)→ 不收 fee
 *   3. sell + ENV_SELL=10 → 收 0.1% sell fee(模拟未来阶段 4)
 *   4. buy + ENV_BUY=5 + sell + ENV_SELL=5 → 进出各 0.05%(模拟未来阶段 3)
 *
 * 加 buildFeeMemoText 文本生成测试(动态化锁定)
 */

const ORIGINAL_BUY = process.env.NEXT_PUBLIC_FEE_BPS_BUY;
const ORIGINAL_SELL = process.env.NEXT_PUBLIC_FEE_BPS_SELL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_FEE_BPS_BUY;
  delete process.env.NEXT_PUBLIC_FEE_BPS_SELL;
});
afterEach(() => {
  if (ORIGINAL_BUY !== undefined) process.env.NEXT_PUBLIC_FEE_BPS_BUY = ORIGINAL_BUY;
  else delete process.env.NEXT_PUBLIC_FEE_BPS_BUY;
  if (ORIGINAL_SELL !== undefined) process.env.NEXT_PUBLIC_FEE_BPS_SELL = ORIGINAL_SELL;
  else delete process.env.NEXT_PUBLIC_FEE_BPS_SELL;
});

describe('getFeeBps · 4 case 覆盖 V1 → 阶段 4 演进', () => {
  it('case 1 · buy + ENV 缺 → 默认 10(0.1% · V1)', () => {
    expect(getFeeBps('buy')).toBe(10);
  });

  it('case 2 · sell + ENV 缺 → 默认 0(V1 不收 sell fee)', () => {
    expect(getFeeBps('sell')).toBe(0);
  });

  it('case 3 · sell + ENV_SELL=10 → 10(0.1% sell · 阶段 4)', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_SELL = '10';
    expect(getFeeBps('sell')).toBe(10);
  });

  it('case 4 · buy ENV=5 + sell ENV=5 → 进出各 0.05%(阶段 3)', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = '5';
    process.env.NEXT_PUBLIC_FEE_BPS_SELL = '5';
    expect(getFeeBps('buy')).toBe(5);
    expect(getFeeBps('sell')).toBe(5);
  });
});

describe('getFeeBps · 防御性边界', () => {
  it('ENV 非数字字符串 → 兜底默认值', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = 'abc';
    expect(getFeeBps('buy')).toBe(10);
    process.env.NEXT_PUBLIC_FEE_BPS_SELL = 'xyz';
    expect(getFeeBps('sell')).toBe(0);
  });

  it('ENV 负数 → 兜底默认值(防 env 配错乱扣 fee)', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = '-5';
    expect(getFeeBps('buy')).toBe(10);
  });

  it('ENV 空字符串 → 兜底默认值', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = '';
    expect(getFeeBps('buy')).toBe(10);
  });

  it('ENV 0 显式配置 → 接受 0(用户主动关 fee)', () => {
    process.env.NEXT_PUBLIC_FEE_BPS_BUY = '0';
    expect(getFeeBps('buy')).toBe(0);
  });
});

describe('buildFeeMemoText · 文本动态化', () => {
  it('V1 buy 0.1% → "Ocufi 0.1% buy fee · ocufi.io/fees"', () => {
    expect(buildFeeMemoText(10, true)).toBe('Ocufi 0.1% buy fee · ocufi.io/fees');
  });

  it('阶段 4 sell 0.1% → "Ocufi 0.1% sell fee · ocufi.io/fees"', () => {
    expect(buildFeeMemoText(10, false)).toBe('Ocufi 0.1% sell fee · ocufi.io/fees');
  });

  it('阶段 3 buy 0.05% → "Ocufi 0.05% buy fee · ocufi.io/fees"(2 位小数)', () => {
    expect(buildFeeMemoText(5, true)).toBe('Ocufi 0.05% buy fee · ocufi.io/fees');
  });

  it('整数百分比 1.0% → "Ocufi 1.0% buy fee"(1 位小数)', () => {
    expect(buildFeeMemoText(100, true)).toBe('Ocufi 1.0% buy fee · ocufi.io/fees');
  });

  it('非整数 0.25% → "Ocufi 0.25% sell fee"(2 位小数)', () => {
    expect(buildFeeMemoText(25, false)).toBe('Ocufi 0.25% sell fee · ocufi.io/fees');
  });
});

/**
 * T-PHANTOM-SPLIT-TX · helper 单测
 *
 * compileV0Tx / assertSafeSize / buildFeeTransferOnly · 纯函数 · 不打 RPC
 *   - compileV0Tx:同入参同结果 → 编译 v0 message + 序列化稳定
 *   - assertSafeSize:边界值(刚好 / 超 1 字节)精准触发 sentinel
 *   - buildFeeTransferOnly:有 memo / 无 memo · transfer ix 字段正确
 *
 * 跟常量校验:PHANTOM_SAFE_SIZE_LIMIT (1150) · SOLANA_TX_SIZE_LIMIT (1232)
 */
describe('T-PHANTOM-SPLIT-TX 常量', () => {
  it('PHANTOM_SAFE_SIZE_LIMIT === 1150(Rory 邮件 2026-04-30)', () => {
    expect(PHANTOM_SAFE_SIZE_LIMIT).toBe(1150);
  });

  it('SOLANA_TX_SIZE_LIMIT === 1232(mainnet packet 硬限)', () => {
    expect(SOLANA_TX_SIZE_LIMIT).toBe(1232);
  });

  it('safe 上限留出 ≥ 80 字节缓冲', () => {
    expect(SOLANA_TX_SIZE_LIMIT - PHANTOM_SAFE_SIZE_LIMIT).toBeGreaterThanOrEqual(80);
  });
});

describe('compileV0Tx · v0 编译纯函数', () => {
  it('返回 VersionedTransaction 实例 · 含 payer + blockhash + 1 ix', () => {
    const payer = Keypair.generate().publicKey;
    const dummyBlockhash = '11111111111111111111111111111111';
    const ixs = buildFeeTransferOnly(
      payer,
      Keypair.generate().publicKey,
      10_000,
      true,
      10,
      false
    );
    const tx = compileV0Tx(payer, dummyBlockhash, ixs, []);
    expect(tx).toBeInstanceOf(VersionedTransaction);
    expect(tx.message.recentBlockhash).toBe(dummyBlockhash);
    // payer 是 staticAccountKeys[0]
    expect(tx.message.staticAccountKeys[0].equals(payer)).toBe(true);
  });

  it('空 ix 数组 → 仍能编译(只有 payer)', () => {
    const payer = Keypair.generate().publicKey;
    const tx = compileV0Tx(payer, '11111111111111111111111111111111', [], []);
    expect(tx).toBeInstanceOf(VersionedTransaction);
    expect(tx.serialize().length).toBeGreaterThan(0);
  });
});

describe('assertSafeSize · 边界精准触发', () => {
  function makeTxOfApproxSize(extraIxCount: number): VersionedTransaction {
    // 多塞 transfer ix 拉大 size · 每条 ~50-80 字节
    const payer = Keypair.generate().publicKey;
    const ixs = [];
    for (let i = 0; i < extraIxCount; i++) {
      ixs.push(
        ...buildFeeTransferOnly(
          payer,
          Keypair.generate().publicKey,
          1000 + i,
          true,
          10,
          false
        )
      );
    }
    return compileV0Tx(payer, '11111111111111111111111111111111', ixs, []);
  }

  it('小 tx(< 1150)→ 不抛', () => {
    const tx = makeTxOfApproxSize(2);
    expect(() => assertSafeSize(tx, PHANTOM_SAFE_SIZE_LIMIT, 'single')).not.toThrow();
    expect(() => assertSafeSize(tx, SOLANA_TX_SIZE_LIMIT, 'single')).not.toThrow();
  });

  it('强行小 limit=10 → 抛 __ERR_TX_TOO_CLOSE_TO_SIZE_LIMIT', () => {
    const tx = makeTxOfApproxSize(1);
    expect(() => assertSafeSize(tx, 10, 'single')).toThrow('__ERR_TX_TOO_CLOSE_TO_SIZE_LIMIT');
  });

  it('label 透传到 console.error 但不影响抛 sentinel', () => {
    const tx = makeTxOfApproxSize(1);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => assertSafeSize(tx, 5, 'setup')).toThrow('__ERR_TX_TOO_CLOSE_TO_SIZE_LIMIT');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('setup'));
    errSpy.mockRestore();
  });
});

describe('buildFeeTransferOnly · transfer ± memo', () => {
  const userKey = new PublicKey('11111111111111111111111111111112');
  const vaultKey = new PublicKey('11111111111111111111111111111113');

  it('includeMemo=false → 仅 1 条 transfer ix(split swap tx 模式)', () => {
    const ixs = buildFeeTransferOnly(userKey, vaultKey, 100_000, true, 10, false);
    expect(ixs).toHaveLength(1);
    // SystemProgram id
    expect(ixs[0].programId.toBase58()).toBe('11111111111111111111111111111111');
  });

  it('includeMemo=true · buy + 10bps → 2 条 ix · memo 含 "0.1% buy fee"', () => {
    const ixs = buildFeeTransferOnly(userKey, vaultKey, 100_000, true, 10, true);
    expect(ixs).toHaveLength(2);
    expect(ixs[1].programId.toBase58()).toBe('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const memoText = Buffer.from(ixs[1].data).toString('utf-8');
    expect(memoText).toContain('Ocufi 0.1% buy fee');
  });

  it('includeMemo=true · sell + 5bps → memo 含 "0.05% sell fee"', () => {
    const ixs = buildFeeTransferOnly(userKey, vaultKey, 50_000, false, 5, true);
    expect(ixs).toHaveLength(2);
    const memoText = Buffer.from(ixs[1].data).toString('utf-8');
    expect(memoText).toContain('Ocufi 0.05% sell fee');
  });

  it('feeLamports = 实参原样传递(transfer ix data 内含 amount)', () => {
    const ixs = buildFeeTransferOnly(userKey, vaultKey, 12_345, true, 10, false);
    // SystemProgram.transfer data layout: [u32 instruction_id, u64 lamports]
    const data = ixs[0].data;
    expect(data.length).toBeGreaterThanOrEqual(12);
    // u64 little-endian @ offset 4
    const lamportsLow = data.readUInt32LE(4);
    expect(lamportsLow).toBe(12_345);
  });
});
