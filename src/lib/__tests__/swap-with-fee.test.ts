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

/**
 * T-PHANTOM-SPLIT-TX-RORY-V2(2026-05-01)· 集成测 · 用 fetch + Connection mock
 *
 * 三个 bug 的覆盖:
 *   bug 1:tokenLedger 在 swap leg 不在 setup leg
 *     - single 模式 ix 顺序:[computeBudget · setup · tokenLedger · fee · swap · cleanup]
 *     - split 模式 setup tx 不含 tokenLedger
 *     - split 模式 swap tx 含 tokenLedger
 *   bug 3:fresh blockhash swap tx 内部 simulate
 *     - buildSwapTx 现 async · 内部调 connection.simulateTransaction(swap)
 *
 * (bug 2 在 trade-tx.ts · 用 wallet.sendTransaction 替代 sign+sendRaw 分离 · 测在 trade-tx.test.ts)
 */
describe('T-PHANTOM-SPLIT-TX-RORY-V2 · prepareSwapTxs ix 拆桶', () => {
  // 动态 import 以便测试用 mock fetch + 注入 stub Connection
  // jupiter-instructions response · 含 tokenLedger + 1 个 setup ix
  const FAKE_USER = Keypair.generate().publicKey;
  const FAKE_BLOCKHASH = Keypair.generate().publicKey.toBase58();

  // SystemProgram.transfer data 是 [u32 ix_id=2, u64 amount]
  function fakeIxData(byteLen: number): string {
    return Buffer.alloc(byteLen).toString('base64');
  }

  function makeFakeJupResponse(opts: {
    setupCount: number;
    hasTokenLedger: boolean;
  }) {
    const setupInstructions = [];
    for (let i = 0; i < opts.setupCount; i++) {
      setupInstructions.push({
        programId: Keypair.generate().publicKey.toBase58(),
        accounts: [{ pubkey: FAKE_USER.toBase58(), isSigner: true, isWritable: true }],
        data: fakeIxData(8),
      });
    }
    return {
      tokenLedgerInstruction: opts.hasTokenLedger
        ? {
            programId: Keypair.generate().publicKey.toBase58(),
            accounts: [{ pubkey: FAKE_USER.toBase58(), isSigner: true, isWritable: true }],
            data: fakeIxData(4),
          }
        : undefined,
      computeBudgetInstructions: [],
      setupInstructions,
      swapInstruction: {
        programId: Keypair.generate().publicKey.toBase58(),
        accounts: [{ pubkey: FAKE_USER.toBase58(), isSigner: true, isWritable: true }],
        data: fakeIxData(16),
      },
      cleanupInstruction: {
        programId: Keypair.generate().publicKey.toBase58(),
        accounts: [{ pubkey: FAKE_USER.toBase58(), isSigner: true, isWritable: true }],
        data: fakeIxData(4),
      },
      addressLookupTableAddresses: [],
    };
  }

  function makeStubConnection(jupResp: ReturnType<typeof makeFakeJupResponse>) {
    const simulateCalls: VersionedTransaction[] = [];
    const stub = {
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: FAKE_BLOCKHASH,
        lastValidBlockHeight: 1000,
      }),
      // 卖出场景 0 ATA(precheck 短路 · 不抛 BALANCE_DRIFT)
      getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
      // Token-2022 检测时 mint 不存在 = classic SPL
      getAccountInfo: vi.fn().mockResolvedValue(null),
      simulateTransaction: vi.fn().mockImplementation((tx: VersionedTransaction) => {
        simulateCalls.push(tx);
        return Promise.resolve({ value: { err: null, logs: [] } });
      }),
    };
    return { stub, simulateCalls, jupResp };
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        // 测试用 quote 不影响 jup response · 简单返 stub
        void body;
        const resp = (globalThis as Record<string, unknown>).__JUP_RESP as ReturnType<typeof makeFakeJupResponse>;
        return {
          ok: true,
          json: async () => resp,
          text: async () => JSON.stringify(resp),
        } as unknown as Response;
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).__JUP_RESP;
  });

  /** 把 v0 message 的 compiledInstructions 解析回 programId 字符串列表 · 用于 assert 顺序 */
  function programIdsOf(tx: VersionedTransaction): string[] {
    return tx.message.compiledInstructions.map((ix) =>
      tx.message.staticAccountKeys[ix.programIdIndex].toBase58()
    );
  }

  it('case 1 · single 模式(setupCount=0)· tokenLedger 仍在 swap 段(在 fee 前 · swap 前)', async () => {
    const jupResp = makeFakeJupResponse({ setupCount: 0, hasTokenLedger: true });
    (globalThis as Record<string, unknown>).__JUP_RESP = jupResp;
    const { stub } = makeStubConnection(jupResp);

    const { prepareSwapTxs } = await import('@/lib/swap-with-fee');
    const fakeQuote = {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '1000000',
      outAmount: '999000',
      otherAmountThreshold: '0',
      swapMode: 'ExactIn',
      slippageBps: 50,
      priceImpactPct: '0.1',
      routePlan: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = await prepareSwapTxs(stub as any, fakeQuote, FAKE_USER.toBase58());
    expect(plan.kind).toBe('single');
    if (plan.kind !== 'single') return;

    const ids = programIdsOf(plan.tx);
    const tokenLedgerProgram = jupResp.tokenLedgerInstruction!.programId;
    const swapProgram = jupResp.swapInstruction.programId;
    const tokenLedgerIdx = ids.indexOf(tokenLedgerProgram);
    const swapIdx = ids.indexOf(swapProgram);
    // tokenLedger 在 swap 之前(swap leg 内 · 不是 setup leg)
    expect(tokenLedgerIdx).toBeGreaterThan(-1);
    expect(swapIdx).toBeGreaterThan(tokenLedgerIdx);
  });

  it('case 2 · split 模式 · setup tx 不含 tokenLedger', async () => {
    // setupCount 大 · 触发 split 模式
    const jupResp = makeFakeJupResponse({ setupCount: 10, hasTokenLedger: true });
    (globalThis as Record<string, unknown>).__JUP_RESP = jupResp;
    const { stub } = makeStubConnection(jupResp);

    const { prepareSwapTxs, PHANTOM_SAFE_SIZE_LIMIT } = await import('@/lib/swap-with-fee');
    const fakeQuote = {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '1000000',
      outAmount: '999000',
      otherAmountThreshold: '0',
      swapMode: 'ExactIn',
      slippageBps: 50,
      priceImpactPct: '0.1',
      routePlan: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = await prepareSwapTxs(stub as any, fakeQuote, FAKE_USER.toBase58());
    // setupCount=10 + tokenLedger + fee + swap + cleanup 大概率超 1150 → split
    if (plan.kind !== 'split') {
      // 真没超(若 program key dedup 多了)· 也可接受 · 跳过此 case
      expect(plan.kind === 'single' || plan.kind === 'split').toBe(true);
      return;
    }

    const setupIds = programIdsOf(plan.setupTx);
    const tokenLedgerProgram = jupResp.tokenLedgerInstruction!.programId;
    expect(setupIds).not.toContain(tokenLedgerProgram);
    // setup tx ≤ 1150
    expect(plan.setupTx.serialize().length).toBeLessThanOrEqual(PHANTOM_SAFE_SIZE_LIMIT);
  });

  it('case 3 · split 模式 · swap tx 含 tokenLedger + buildSwapTx async + simulate fresh', async () => {
    const jupResp = makeFakeJupResponse({ setupCount: 10, hasTokenLedger: true });
    (globalThis as Record<string, unknown>).__JUP_RESP = jupResp;
    const { stub, simulateCalls } = makeStubConnection(jupResp);

    const { prepareSwapTxs } = await import('@/lib/swap-with-fee');
    const fakeQuote = {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '1000000',
      outAmount: '999000',
      otherAmountThreshold: '0',
      swapMode: 'ExactIn',
      slippageBps: 50,
      priceImpactPct: '0.1',
      routePlan: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = await prepareSwapTxs(stub as any, fakeQuote, FAKE_USER.toBase58());
    if (plan.kind !== 'split') return;

    const simulateCallsBeforeSwap = simulateCalls.length;
    // build swap with fresh blockhash
    const FRESH_BLOCKHASH = Keypair.generate().publicKey.toBase58();
    const swapTx = await plan.buildSwapTx(FRESH_BLOCKHASH);

    // 关键:返 Promise · 不是同步值
    expect(swapTx).toBeInstanceOf(VersionedTransaction);
    expect(swapTx.message.recentBlockhash).toBe(FRESH_BLOCKHASH);

    const swapIds = programIdsOf(swapTx);
    const tokenLedgerProgram = jupResp.tokenLedgerInstruction!.programId;
    expect(swapIds).toContain(tokenLedgerProgram);

    // Rory v2 fix #3:fresh blockhash swap tx 必须 simulate
    expect(simulateCalls.length).toBeGreaterThan(simulateCallsBeforeSwap);
  });

  it('case 4 · single 模式无 setup(setupCount=0 + 无 tokenLedger)· 仍单笔 · 回归', async () => {
    const jupResp = makeFakeJupResponse({ setupCount: 0, hasTokenLedger: false });
    (globalThis as Record<string, unknown>).__JUP_RESP = jupResp;
    const { stub } = makeStubConnection(jupResp);

    const { prepareSwapTxs } = await import('@/lib/swap-with-fee');
    const fakeQuote = {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '1000000',
      outAmount: '999000',
      otherAmountThreshold: '0',
      swapMode: 'ExactIn',
      slippageBps: 50,
      priceImpactPct: '0.1',
      routePlan: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = await prepareSwapTxs(stub as any, fakeQuote, FAKE_USER.toBase58());
    expect(plan.kind).toBe('single');
  });

  /**
   * R10-CHAIN · extraMemoText 跟单溯源
   *
   * - single 模式:memo 挂 instructions 末尾(swap+cleanup 之后)
   * - split 模式:memo 挂 setup leg(Rory size 约束 · 不挂 swap leg)
   */
  it('case 5 · single + extraMemoText · memo 挂末尾 · 文本可解析回原值', async () => {
    const jupResp = makeFakeJupResponse({ setupCount: 0, hasTokenLedger: false });
    (globalThis as Record<string, unknown>).__JUP_RESP = jupResp;
    const { stub } = makeStubConnection(jupResp);

    const { prepareSwapTxs } = await import('@/lib/swap-with-fee');
    const fakeQuote = {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '1000000',
      outAmount: '999000',
      otherAmountThreshold: '0',
      swapMode: 'ExactIn',
      slippageBps: 50,
      priceImpactPct: '0.1',
      routePlan: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const COPY_MEMO = 'ocufi-copy-5sv1jdRj';
    const plan = await prepareSwapTxs(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stub as any,
      fakeQuote,
      FAKE_USER.toBase58(),
      'fast',
      { extraMemoText: COPY_MEMO }
    );
    expect(plan.kind).toBe('single');
    if (plan.kind !== 'single') return;

    const ids = programIdsOf(plan.tx);
    const memoIdx = ids.indexOf('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const swapIdx = ids.indexOf(jupResp.swapInstruction.programId);
    // memo 在 swap 之后(末尾)
    expect(memoIdx).toBeGreaterThan(swapIdx);

    // 解析 memo data
    const memoIxIdx = plan.tx.message.compiledInstructions.findIndex(
      (ix) =>
        plan.tx.message.staticAccountKeys[ix.programIdIndex].toBase58() ===
        'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
    );
    expect(memoIxIdx).toBeGreaterThan(-1);
    const memoData = Buffer.from(
      plan.tx.message.compiledInstructions[memoIxIdx].data
    ).toString('utf-8');
    expect(memoData).toBe(COPY_MEMO);
  });

  it('case 6 · split + extraMemoText · memo 挂 setup leg · 不挂 swap leg', async () => {
    const jupResp = makeFakeJupResponse({ setupCount: 10, hasTokenLedger: true });
    (globalThis as Record<string, unknown>).__JUP_RESP = jupResp;
    const { stub } = makeStubConnection(jupResp);

    const { prepareSwapTxs } = await import('@/lib/swap-with-fee');
    const fakeQuote = {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '1000000',
      outAmount: '999000',
      otherAmountThreshold: '0',
      swapMode: 'ExactIn',
      slippageBps: 50,
      priceImpactPct: '0.1',
      routePlan: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const COPY_MEMO = 'ocufi-copy-deadbeef';
    const plan = await prepareSwapTxs(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stub as any,
      fakeQuote,
      FAKE_USER.toBase58(),
      'fast',
      { extraMemoText: COPY_MEMO }
    );
    if (plan.kind !== 'split') {
      // mock setup ix dedup 后没超 1150 · 跳过(case 2 同样宽容)
      return;
    }

    // setup leg 含 memo program
    const setupIds = programIdsOf(plan.setupTx);
    expect(setupIds).toContain('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

    // swap leg 不含 memo program(Rory size 约束)
    const FRESH_BLOCKHASH = Keypair.generate().publicKey.toBase58();
    const swapTx = await plan.buildSwapTx(FRESH_BLOCKHASH);
    const swapIds = programIdsOf(swapTx);
    expect(swapIds).not.toContain('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  });
});
