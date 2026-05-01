// @vitest-environment node
// 跟 swap-with-fee.test.ts 同 · node 环境跑 · 避 jsdom Buffer polyfill 不兼容
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { buildCopyTx, type CopyExecutionInput } from '@/lib/copy-trade';

/**
 * R10-CHAIN · copy-trade.ts 单测
 *
 * 覆盖 SPEC 要求的 4 件事:
 *   1. memo 文本格式 `ocufi-copy-{leaderSig.slice(0, 8)}` 嵌入 plan
 *   2. slippageBps 透传到 Jupiter quote URL
 *   3. followerInputAmount 透传到 Jupiter quote URL · raw 不丢精度
 *   4. NONHELD sentinel · follower 不持有卖出 token 时跳单
 *   + plan 复用 prepareSwapTxs 路径(回 single / split SplitTxPlan)
 */

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const FAKE_FOLLOWER = Keypair.generate().publicKey;
const FAKE_BLOCKHASH = Keypair.generate().publicKey.toBase58();
const FAKE_LEADER_SIG =
  '5sv1jdRjQSu4iqwn8VmpzAEqGfWX6jbVN8ahMrU4ASjyDhPpRyFMqHkVHnGzsm56NaHv7XjAxc1Y6QcG9DCnj1nQ';

function fakeIxData(byteLen: number): string {
  return Buffer.alloc(byteLen).toString('base64');
}

function makeFakeJupSwapInstructions() {
  return {
    tokenLedgerInstruction: undefined,
    computeBudgetInstructions: [],
    setupInstructions: [],
    swapInstruction: {
      programId: Keypair.generate().publicKey.toBase58(),
      accounts: [{ pubkey: FAKE_FOLLOWER.toBase58(), isSigner: true, isWritable: true }],
      data: fakeIxData(16),
    },
    cleanupInstruction: undefined,
    addressLookupTableAddresses: [],
  };
}

function makeStubConnection(opts?: { tokenAccounts?: Array<{ amount: string }> }) {
  return {
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: FAKE_BLOCKHASH,
      lastValidBlockHeight: 1000,
    }),
    getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({
      value: (opts?.tokenAccounts ?? []).map((t) => ({
        account: { data: { parsed: { info: { tokenAmount: { amount: t.amount } } } } },
      })),
    }),
    // Token-2022 检测时 mint 不存在 = classic SPL
    getAccountInfo: vi.fn().mockResolvedValue(null),
    simulateTransaction: vi.fn().mockResolvedValue({ value: { err: null, logs: [] } }),
  };
}

/**
 * fetch mock · 区分 quote 与 swap-instructions URL
 *  - quote URL 含 'quote'(返 JupiterQuote-shaped 对象)
 *  - swap-instructions URL 含 'swap-instructions'(返 jupiter ix bundle)
 *
 * 调用记录暴露给测试断言(quote URL 校验 amount/slippageBps 等参数)
 */
function makeFetchMock(quoteOverrides?: Partial<Record<string, string | number>>) {
  const calls: string[] = [];
  const fetchFn = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    calls.push(String(url));
    const u = String(url);
    if (u.includes('quote')) {
      const params = new URL(u).searchParams;
      return {
        ok: true,
        json: async () => ({
          inputMint: params.get('inputMint'),
          outputMint: params.get('outputMint'),
          inAmount: params.get('amount'),
          outAmount: '999000',
          otherAmountThreshold: '0',
          swapMode: 'ExactIn',
          slippageBps: Number(params.get('slippageBps') ?? '0'),
          priceImpactPct: '0.1',
          routePlan: [],
          ...quoteOverrides,
        }),
        text: async () => '',
      } as unknown as Response;
    }
    // swap-instructions
    void init;
    return {
      ok: true,
      json: async () => makeFakeJupSwapInstructions(),
      text: async () => '',
    } as unknown as Response;
  });
  return { fetchFn, calls };
}

beforeEach(() => {
  // 给 prepareSwapTxs 用的 OCUFI_FEE_VAULT · 不配则 fee ix 不挂(对 memo 测试无影响)
  delete process.env.NEXT_PUBLIC_OCUFI_FEE_VAULT;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('R10-CHAIN · buildCopyTx 输入校验', () => {
  it('followerInputAmount=0 → __ERR_COPY_AMOUNT_INVALID', async () => {
    const { fetchFn } = makeFetchMock();
    vi.stubGlobal('fetch', fetchFn);
    const stub = makeStubConnection();
    const input: CopyExecutionInput = {
      leaderInputMint: SOL,
      leaderOutputMint: USDC,
      followerInputAmount: BigInt(0),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 500,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(buildCopyTx(stub as any, input)).rejects.toThrow('__ERR_COPY_AMOUNT_INVALID');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('slippageBps 越界(> 10000)→ __ERR_COPY_SLIPPAGE_INVALID', async () => {
    const stub = makeStubConnection();
    const input: CopyExecutionInput = {
      leaderInputMint: SOL,
      leaderOutputMint: USDC,
      followerInputAmount: BigInt(1_000_000),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 10_001,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(buildCopyTx(stub as any, input)).rejects.toThrow('__ERR_COPY_SLIPPAGE_INVALID');
  });

  it('leaderSignature < 8 字符 → __ERR_COPY_LEADER_SIG_INVALID', async () => {
    const stub = makeStubConnection();
    const input: CopyExecutionInput = {
      leaderInputMint: SOL,
      leaderOutputMint: USDC,
      followerInputAmount: BigInt(1_000_000),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 500,
      leaderSignature: 'short',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(buildCopyTx(stub as any, input)).rejects.toThrow('__ERR_COPY_LEADER_SIG_INVALID');
  });
});

describe('R10-CHAIN · NONHELD 卖出预探', () => {
  it('卖出 + follower 0 余额 → __ERR_COPY_LEADER_SOLD_NONHELD(不打 Jupiter)', async () => {
    const { fetchFn } = makeFetchMock();
    vi.stubGlobal('fetch', fetchFn);
    const stub = makeStubConnection({ tokenAccounts: [] });
    const input: CopyExecutionInput = {
      leaderInputMint: USDC, // SPL 卖
      leaderOutputMint: SOL,
      followerInputAmount: BigInt(1_000_000),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 500,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(buildCopyTx(stub as any, input)).rejects.toThrow(
      '__ERR_COPY_LEADER_SOLD_NONHELD'
    );
    // 没打 quote(NONHELD 在 quote 之前抛 · 不浪费 Jupiter 配额)
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('卖出 + follower 有余额 → 继续走 quote · 不抛 NONHELD', async () => {
    const { fetchFn } = makeFetchMock();
    vi.stubGlobal('fetch', fetchFn);
    const stub = makeStubConnection({ tokenAccounts: [{ amount: '5000000' }] });
    const input: CopyExecutionInput = {
      leaderInputMint: USDC,
      leaderOutputMint: SOL,
      followerInputAmount: BigInt(1_000_000),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 500,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await buildCopyTx(stub as any, input);
    expect(out.plan.kind).toBe('single');
    // 至少打 quote + swap-instructions 各一次
    expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('买入(SOL → SPL)· 不需要 NONHELD 探测 · 直接走 quote', async () => {
    const { fetchFn } = makeFetchMock();
    vi.stubGlobal('fetch', fetchFn);
    const stub = makeStubConnection({ tokenAccounts: [] }); // 0 余额也不该触发(买入)
    const input: CopyExecutionInput = {
      leaderInputMint: SOL,
      leaderOutputMint: USDC,
      followerInputAmount: BigInt(1_000_000),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 500,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await buildCopyTx(stub as any, input);
    expect(out.plan.kind).toBe('single');
    // 卖出场景才会调 getParsedTokenAccountsByOwner 探 NONHELD
    // 买入场景不调(prepareSwapTxs 内部仍可能调 · 但 buildCopyTx 自身入口不调)
  });
});

describe('R10-CHAIN · quote URL 参数透传', () => {
  it('followerInputAmount = 1_500_000 raw · slippageBps = 300 · URL 含 amount=1500000 + slippageBps=300', async () => {
    const { fetchFn, calls } = makeFetchMock();
    vi.stubGlobal('fetch', fetchFn);
    const stub = makeStubConnection();
    const input: CopyExecutionInput = {
      leaderInputMint: SOL,
      leaderOutputMint: USDC,
      followerInputAmount: BigInt(1_500_000),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 300,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await buildCopyTx(stub as any, input);
    const quoteCall = calls.find((u) => u.includes('quote'));
    expect(quoteCall).toBeDefined();
    const params = new URL(quoteCall!).searchParams;
    expect(params.get('amount')).toBe('1500000');
    expect(params.get('slippageBps')).toBe('300');
    expect(params.get('inputMint')).toBe(SOL);
    expect(params.get('outputMint')).toBe(USDC);
    // 跟单不挂 platformFeeBps(走 swap-with-fee 0.1% buy 路径 · Jupiter 内置 referral 不要)
    expect(params.get('platformFeeBps')).toBeNull();
  });

  it('大 BigInt 不丢精度 · 9 亿 lamports raw', async () => {
    const { calls, fetchFn } = makeFetchMock();
    vi.stubGlobal('fetch', fetchFn);
    const stub = makeStubConnection();
    const HUGE = BigInt('900000000000000000'); // 9e17 · 远超 2^53
    const input: CopyExecutionInput = {
      leaderInputMint: SOL,
      leaderOutputMint: USDC,
      followerInputAmount: HUGE,
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 500,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await buildCopyTx(stub as any, input);
    const quoteCall = calls.find((u) => u.includes('quote'));
    const params = new URL(quoteCall!).searchParams;
    expect(params.get('amount')).toBe('900000000000000000');
  });
});

describe('R10-CHAIN · memo 嵌入 + plan 复用', () => {
  it('memo 文本 = ocufi-copy-{leaderSig.slice(0, 8)} · 出现在 plan.memoText + plan.plan.tx', async () => {
    const { fetchFn } = makeFetchMock();
    vi.stubGlobal('fetch', fetchFn);
    const stub = makeStubConnection();
    const input: CopyExecutionInput = {
      leaderInputMint: SOL,
      leaderOutputMint: USDC,
      followerInputAmount: BigInt(1_000_000),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 500,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await buildCopyTx(stub as any, input);

    const expectedMemo = `ocufi-copy-${FAKE_LEADER_SIG.slice(0, 8)}`;
    expect(out.memoText).toBe(expectedMemo);

    if (out.plan.kind !== 'single') return;
    const tx = out.plan.tx;
    const ids = tx.message.compiledInstructions.map((ix) =>
      tx.message.staticAccountKeys[ix.programIdIndex].toBase58()
    );
    expect(ids).toContain('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const memoIxIdx = tx.message.compiledInstructions.findIndex(
      (ix) =>
        tx.message.staticAccountKeys[ix.programIdIndex].toBase58() ===
        'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
    );
    const memoData = Buffer.from(
      tx.message.compiledInstructions[memoIxIdx].data
    ).toString('utf-8');
    expect(memoData).toBe(expectedMemo);
  });

  it('返回 expectedOutputAmount = BigInt(quote.outAmount)', async () => {
    const { fetchFn } = makeFetchMock();
    vi.stubGlobal('fetch', fetchFn);
    const stub = makeStubConnection();
    const input: CopyExecutionInput = {
      leaderInputMint: SOL,
      leaderOutputMint: USDC,
      followerInputAmount: BigInt(1_000_000),
      followerWallet: FAKE_FOLLOWER,
      slippageBps: 500,
      leaderSignature: FAKE_LEADER_SIG,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await buildCopyTx(stub as any, input);
    expect(out.expectedOutputAmount).toBe(BigInt('999000'));
  });
});
