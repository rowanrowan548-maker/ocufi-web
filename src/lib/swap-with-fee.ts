/**
 * 自组 swap tx,在 Jupiter swap 指令前插一条 SystemProgram.transfer 收 fee
 *
 * 动机:Jupiter 官方 Referral 走 Referral Program `REFER4Zg...`,OKX 钱包
 *   风控把这个 program 视为未白名单,preflight 直接拒。改用 Solana 原生
 *   SystemProgram.transfer 收 fee,所有钱包都认。
 *
 * T-PHANTOM-SPLIT-TX(2026-04-30 · Phantom 工程师 Rory 反馈):
 *   1 笔 v0 tx 含 [setup · fee · memo · swap · cleanup] 在接近 1232 字节时
 *   "对钱包模拟来说很 fragile · 即使能序列化也会触发警告"。
 *   解法:setup 不空 + 单笔 size > PHANTOM_SAFE_SIZE_LIMIT(1150) → 拆 2 笔
 *     - setup tx:[computeBudget · setup]
 *     - swap tx:[computeBudget · tokenLedger · fee · swap · cleanup](无 memo · Rory 强调)
 *   小路由(setup 空 / size 小)仍单笔 · memo 保留(合规/链上溯源)。
 *
 * 流程:
 *  1. POST /swap/v1/swap-instructions 拿原始指令数组
 *  2. 构建 instructions 列表
 *  3. fetch 所有 ALT,组 v0 tx
 *  4. size 决策 → single 或 split
 *  5. 返回 SplitTxPlan 给前端
 *
 * V1 收费策略:
 *  - 买入(input = SOL):0.1% SystemProgram.transfer 到 vault(env 默认)
 *  - 卖出(input = SPL):env 默认 0% · 阶段 4 可改 NEXT_PUBLIC_FEE_BPS_SELL
 */
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import type { JupiterQuote, GasLevel } from './jupiter';
import { getCurrentChain } from '@/config/chains';
import { SOL_MINT, TOKEN_2022_PROGRAM_ID } from './portfolio';

const GAS_CONFIG: Record<GasLevel, { priorityLevel: string; maxLamports: number }> = {
  normal: { priorityLevel: 'medium', maxLamports: 5_000 },
  fast: { priorityLevel: 'high', maxLamports: 50_000 },
  turbo: { priorityLevel: 'veryHigh', maxLamports: 1_000_000 },
};

// SPL Memo program v2 · Solana 第一方 program,所有钱包识别
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * T-PHANTOM-SPLIT-TX · Phantom 钱包模拟"安全" size 上限
 *
 * Solana mainnet packet 硬限制 1232 字节(超直接拒)· 但 Phantom Lighthouse / Blowfish
 * 模拟在接近 1232 时 fragile(Rory 邮件 2026-04-30 原话)→ 红警。留 82 字节缓冲。
 *
 * 单笔超 1150 + 有 setup → 拆 2 笔:setup + swap
 * 单笔超 1232 → 抛 __ERR_TX_SIZE_OVERFLOW(理论 ALT + split 后不该触发)
 */
export const PHANTOM_SAFE_SIZE_LIMIT = 1150;
export const SOLANA_TX_SIZE_LIMIT = 1232;

/**
 * T-FEE-CONFIG · Fee bps 改读 env 驱动(用户决策 2026-04-29 · V1 维持 0.1%/0% 不变 ·
 * 阶段 2/3/4 改 env 即可不动代码)
 */
export function getFeeBps(side: 'buy' | 'sell'): number {
  const envVal =
    side === 'buy'
      ? process.env.NEXT_PUBLIC_FEE_BPS_BUY
      : process.env.NEXT_PUBLIC_FEE_BPS_SELL;
  const defaultVal = side === 'buy' ? 10 : 0;
  if (!envVal) return defaultVal;
  const parsed = parseInt(envVal, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultVal;
}

/** 构造 fee 转账的 SPL Memo 文本(动态化 · 钱包 simulation UI 显示用途) */
export function buildFeeMemoText(bps: number, isBuy: boolean): string {
  const pctNum = bps / 100;
  const pctStr = bps % 10 === 0 ? pctNum.toFixed(1) : pctNum.toFixed(2);
  return `Ocufi ${pctStr}% ${isBuy ? 'buy' : 'sell'} fee · ocufi.io/fees`;
}

interface JsonAccount {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}
interface JsonInstruction {
  programId: string;
  accounts: JsonAccount[];
  data: string; // base64
}

interface SwapInstructionsResponse {
  tokenLedgerInstruction?: JsonInstruction;
  computeBudgetInstructions: JsonInstruction[];
  setupInstructions: JsonInstruction[];
  swapInstruction: JsonInstruction;
  cleanupInstruction?: JsonInstruction;
  addressLookupTableAddresses: string[];
  prioritizationFeeLamports?: number;
}

function jsonToIx(ix: JsonInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((a) => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(ix.data, 'base64'),
  });
}

/** 从 env 取 Ocufi fee vault 地址(一个普通 wallet pubkey,不是 Referral PDA) */
function getFeeVault(): PublicKey | null {
  const s = process.env.NEXT_PUBLIC_OCUFI_FEE_VAULT;
  if (!s) return null;
  try {
    return new PublicKey(s);
  } catch {
    return null;
  }
}

// ─── T-PHANTOM-SPLIT-TX helpers ───

/**
 * 编译 v0 VersionedTransaction · 纯函数(同入参同结果 · 测试友好)
 *
 * @param payerKey   付费方(用户 publicKey)
 * @param blockhash  recent blockhash · 调用方负责拿 fresh
 * @param instructions ix 数组(已含 ComputeBudget / setup / fee / swap 等)
 * @param alts       address lookup tables · 让 v0 tx 跨多账户压缩
 */
export function compileV0Tx(
  payerKey: PublicKey,
  blockhash: string,
  instructions: TransactionInstruction[],
  alts: AddressLookupTableAccount[]
): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(alts);
  return new VersionedTransaction(message);
}

/**
 * tx size 自检 · 超 limit 抛 sentinel
 *
 * @param tx     已编译的 VersionedTransaction
 * @param limit  字节上限(PHANTOM_SAFE_SIZE_LIMIT 1150 · SOLANA_TX_SIZE_LIMIT 1232)
 * @param label  日志标签(单笔 / setup / swap)
 *
 * @throws __ERR_TX_TOO_CLOSE_TO_SIZE_LIMIT(超 limit 抛 · 让调用方决定走 split / 报错)
 */
export function assertSafeSize(
  tx: VersionedTransaction,
  limit: number,
  label: string
): void {
  const size = tx.serialize().length;
  if (size > limit) {
    console.error(
      `[swap-with-fee] ${label} tx size ${size} > ${limit} bytes · ` +
        `Phantom Lighthouse fragile · split 或拒收`
    );
    throw new Error('__ERR_TX_TOO_CLOSE_TO_SIZE_LIMIT');
  }
}

/**
 * 构造 fee transfer + 可选 memo 的 ix 数组
 *
 * @param userPublicKey 用户地址
 * @param vault         vault PublicKey(env 配置)
 * @param feeLamports   实际 fee lamports(已按 bps 算出)
 * @param isBuy         buy / sell 区分(用于 memo 文本)
 * @param sideFeeBps    bps 值(用于 memo 文本格式化)
 * @param includeMemo   是否含 SPL Memo · split 大路由 swap tx 时为 false(Rory 强调删)
 */
export function buildFeeTransferOnly(
  userPublicKey: PublicKey,
  vault: PublicKey,
  feeLamports: number,
  isBuy: boolean,
  sideFeeBps: number,
  includeMemo: boolean
): TransactionInstruction[] {
  const ixs: TransactionInstruction[] = [];
  ixs.push(
    SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: vault,
      lamports: feeLamports,
    })
  );
  if (includeMemo) {
    const memoText = buildFeeMemoText(sideFeeBps, isBuy);
    ixs.push(
      new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [{ pubkey: userPublicKey, isSigner: true, isWritable: false }],
        data: Buffer.from(memoText, 'utf-8'),
      })
    );
  }
  return ixs;
}

// ─── prepareSwapTxs · 主入口 ───

/**
 * SplitTxPlan · 单笔 / 拆 2 笔决策结果
 *
 * - kind='single':setup 空 / 单笔 size <= PHANTOM_SAFE_SIZE_LIMIT · memo 保留
 * - kind='split' :setup 不空 + 单笔 size > 1150 · setup tx + swap tx 拆开 · swap tx 删 memo
 *
 * 前端流程(kind='split' · T-PHANTOM-SPLIT-TX-RORY-V2):
 *   1. wallet.sendTransaction(setupTx, connection) → confirmTx (sign + send 一次性 · 不分离)
 *   2. const { blockhash } = await connection.getLatestBlockhash('confirmed')
 *   3. const swapTx = await plan.buildSwapTx(blockhash)  // 内部 simulate · async
 *   4. wallet.sendTransaction(swapTx, connection) → confirmTx
 *
 * Rory 强调:setup wrap SOL 后用户取消 swap → app **必须**有 cleanup/unwrap 逃生口
 * (T-PHANTOM-SPLIT-TX-CLEANUP 后续 ship)
 */
export type SplitTxPlan =
  | { kind: 'single'; tx: VersionedTransaction }
  | {
      kind: 'split';
      setupTx: VersionedTransaction;
      /**
       * setup confirm 后调 · 传 fresh blockhash · **内部 simulate**(Rory v2 第 3 个 fix)
       *
       * async · 因为内部跑 simulate(防 stale blockhash 让 Phantom 红警/失败)
       */
      buildSwapTx: (latestBlockhash: string) => Promise<VersionedTransaction>;
    };

/**
 * prepareSwapTxs 可选参数
 *
 * - extraMemoText:R10-CHAIN · 额外的 SPL Memo 文本(链上溯源 · 跟单 leader_sig 绑定)
 *   - single 模式:append 到 instructions 末尾(swap+cleanup 之后)
 *   - split 模式:挂在 setup leg 末尾(Rory 强调 swap leg 必须 size 紧凑 · 不挂 swap leg)
 *   - 长度建议 ≤ 64 字节(memo 太长会撑爆 size · 内部有 size 自检兜底)
 */
export interface PrepareSwapTxsOpts {
  extraMemoText?: string;
}

/**
 * 准备 swap 交易计划 · 自动决策 single / split
 *
 * 1. ATA 余额 sanity(卖出场景)
 * 2. Token-2022 检测(影响 useSharedAccounts)
 * 3. POST Jupiter /swap-instructions
 * 4. 组 1 笔单 tx · 看 size
 *    - setup 空 OR size <= PHANTOM_SAFE_SIZE_LIMIT → kind='single'
 *    - 否则 → kind='split'(setup tx + swap tx)
 * 5. simulate(single 模式 simulate 单 tx · split 模式 simulate setup · swap 由前端 send 时模拟)
 */
export async function prepareSwapTxs(
  connection: Connection,
  quote: JupiterQuote,
  userPublicKey: string,
  gasLevel: GasLevel = 'fast',
  opts: PrepareSwapTxsOpts = {}
): Promise<SplitTxPlan> {
  const chain = getCurrentChain();
  const gas = GAS_CONFIG[gasLevel];
  const userPubkey = new PublicKey(userPublicKey);

  // 0. 卖出场景 ATA 余额 sanity check(挡 30s 轮询余额竞态 N3)
  if (quote.inputMint !== SOL_MINT) {
    let onChainTotal = BigInt(0);
    let probeOk = false;
    try {
      const res = await connection.getParsedTokenAccountsByOwner(userPubkey, {
        mint: new PublicKey(quote.inputMint),
      });
      probeOk = true;
      for (const acc of res.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const info: any = acc.account.data;
        const amt = info?.parsed?.info?.tokenAmount;
        if (amt) onChainTotal += BigInt(String(amt.amount ?? '0'));
      }
    } catch (e) {
      console.warn('[swap-with-fee] balance precheck failed, skipping:', e);
    }
    if (probeOk && onChainTotal > BigInt(0)) {
      const need = BigInt(quote.inAmount);
      if (onChainTotal < need) {
        throw new Error('__ERR_BALANCE_DRIFT');
      }
    }
  }

  // 0.5. T-814 · Token-2022 兼容
  const nonSolMint = quote.inputMint === SOL_MINT ? quote.outputMint : quote.inputMint;
  let useSharedAccounts = true;
  try {
    const info = await connection.getAccountInfo(new PublicKey(nonSolMint));
    if (info && info.owner.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58()) {
      useSharedAccounts = false;
      console.info(
        '[swap-with-fee] Token-2022 mint detected, useSharedAccounts=false:',
        nonSolMint.slice(0, 8)
      );
    }
  } catch (e) {
    console.warn(
      '[swap-with-fee] mint owner probe failed, defaulting useSharedAccounts=false (safer):',
      e
    );
    useSharedAccounts = false;
  }

  // 1. 拿 Jupiter 原始指令
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    quoteResponse: quote,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    useSharedAccounts,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        priorityLevel: gas.priorityLevel,
        maxLamports: gas.maxLamports,
      },
    },
  };

  const instructionsUrl = chain.dexAggregator.swapUrl!.replace(/\/swap$/, '/swap-instructions');
  const res = await fetch(instructionsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jupiter swap-instructions failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const resp = (await res.json()) as SwapInstructionsResponse;

  // 2. 共用 ComputeBudget(两笔都加 · 见 T-812-fix2)
  const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId.toBase58();
  const filteredJupiterBudgetIxs = resp.computeBudgetInstructions.filter((ix) => {
    if (ix.programId !== COMPUTE_BUDGET_PROGRAM_ID) return true;
    const data = Buffer.from(ix.data, 'base64');
    return !(data.length > 0 && data[0] === 2);
  });
  const computeBudgetIxs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ...filteredJupiterBudgetIxs.map(jsonToIx),
  ];

  // 3. setup ix 集 · T-PHANTOM-SPLIT-TX-RORY-V2(2026-05-01):
  //    Rory 第二轮反馈:tokenLedger 属于 swap leg · 不属于 setup leg · 拆开存
  //    setupIxs 仅含 createATA / wrap SOL 等纯 setup · tokenLedger 单独存到 swap leg
  const setupIxs: TransactionInstruction[] = resp.setupInstructions.map(jsonToIx);
  const tokenLedgerIxs: TransactionInstruction[] = resp.tokenLedgerInstruction
    ? [jsonToIx(resp.tokenLedgerInstruction)]
    : [];

  // 4. fee ix(transfer + 可选 memo · split 模式时调用方 includeMemo=false)
  const vault = getFeeVault();
  const isBuy = quote.inputMint === SOL_MINT;
  const sideFeeBps = getFeeBps(isBuy ? 'buy' : 'sell');
  const feeLamports =
    vault && sideFeeBps > 0
      ? Math.floor((Number(quote.inAmount) * sideFeeBps) / 10_000)
      : 0;
  const buildFeeIxs = (includeMemo: boolean): TransactionInstruction[] =>
    vault && feeLamports > 0
      ? buildFeeTransferOnly(userPubkey, vault, feeLamports, isBuy, sideFeeBps, includeMemo)
      : [];

  // 5. swap + cleanup
  const swapAndCleanup: TransactionInstruction[] = [jsonToIx(resp.swapInstruction)];
  if (resp.cleanupInstruction) swapAndCleanup.push(jsonToIx(resp.cleanupInstruction));

  // 5.5 extraMemo · R10-CHAIN 跟单溯源
  //   single:append 到末尾(整体 size 仍受 PHANTOM_SAFE_SIZE_LIMIT 约束)
  //   split :挂 setup leg 末尾(Rory 强调 swap leg size 紧凑 · 不挂 swap leg)
  const extraMemoIxs: TransactionInstruction[] = opts.extraMemoText
    ? [
        new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [{ pubkey: userPubkey, isSigner: true, isWritable: false }],
          data: Buffer.from(opts.extraMemoText, 'utf-8'),
        }),
      ]
    : [];

  // 6. 加载 ALT
  const alts: AddressLookupTableAccount[] = await Promise.all(
    resp.addressLookupTableAddresses.map(async (addr) => {
      const info = await connection.getAccountInfo(new PublicKey(addr));
      if (!info) throw new Error(`ALT ${addr} not found`);
      return new AddressLookupTableAccount({
        key: new PublicKey(addr),
        state: AddressLookupTableAccount.deserialize(info.data),
      });
    })
  );

  // 7. 试组单笔 tx · 看 size 决定 single / split
  //    T-PHANTOM-SPLIT-TX-RORY-V2:single 内 tokenLedger 在 swap 段(setup 后 / fee 前)
  //    R10-CHAIN:extraMemo 挂末尾(swap+cleanup 之后)· 不参与 fee 流程
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const singleAllIxs = [
    ...computeBudgetIxs,
    ...setupIxs,
    ...tokenLedgerIxs,
    ...buildFeeIxs(true), // single 模式保留 memo
    ...swapAndCleanup,
    ...extraMemoIxs,
  ];
  const singleTx = compileV0Tx(userPubkey, blockhash, singleAllIxs, alts);
  const singleSize = singleTx.serialize().length;

  // 8. 决策
  const needSplit = setupIxs.length > 0 && singleSize > PHANTOM_SAFE_SIZE_LIMIT;

  if (!needSplit) {
    // single 模式 · 走原 buildSwapTxWithFee 行为 · simulate 自检
    assertSafeSize(singleTx, SOLANA_TX_SIZE_LIMIT, 'single');
    await simulateOrThrow(connection, singleTx);
    return { kind: 'single', tx: singleTx };
  }

  // split 模式
  console.info(
    `[swap-with-fee] split tx · single size ${singleSize} > ${PHANTOM_SAFE_SIZE_LIMIT} · ` +
      `setup ix=${setupIxs.length} · per Rory 2026-04-30 / 2026-05-01`
  );

  // setup tx · [computeBudget · setup · extraMemo?]
  //   T-PHANTOM-SPLIT-TX-RORY-V2:tokenLedger 不放这 · setup 必须只有 createATA / wrap 等纯 setup
  //   R10-CHAIN:extraMemo 挂这里(setup leg)· 不挂 swap leg(Rory size 约束)
  const setupTxIxs = [...computeBudgetIxs, ...setupIxs, ...extraMemoIxs];
  const setupTx = compileV0Tx(userPubkey, blockhash, setupTxIxs, alts);
  assertSafeSize(setupTx, PHANTOM_SAFE_SIZE_LIMIT, 'setup');
  await simulateOrThrow(connection, setupTx);

  // swap tx 闭包 · 调用时拿 fresh blockhash · 不带 memo(Rory 强调删)
  //   T-PHANTOM-SPLIT-TX-RORY-V2:tokenLedger 跟着 swap 一起 · 拿 fresh blockhash 后必须 simulate
  const swapTxIxs = [...computeBudgetIxs, ...tokenLedgerIxs, ...buildFeeIxs(false), ...swapAndCleanup];
  const buildSwapTx = async (freshBlockhash: string): Promise<VersionedTransaction> => {
    const swapTx = compileV0Tx(userPubkey, freshBlockhash, swapTxIxs, alts);
    // swap tx 严格不超 Solana 上限(没法再拆,拆完仍超只能报错)
    assertSafeSize(swapTx, SOLANA_TX_SIZE_LIMIT, 'swap');
    // Rory v2 第 3 个 fix:fresh blockhash 后必须 simulate · 防 stale/reorder 失败
    await simulateOrThrow(connection, swapTx);
    return swapTx;
  };

  return { kind: 'split', setupTx, buildSwapTx };
}

/**
 * simulateTransaction 自检(T-810/T-972)· 抽出独立 helper · 给 single / setup 共用
 *
 * sim.value.err 非空 → 按 logs 分类抛具体 sentinel(T-972)
 */
async function simulateOrThrow(
  connection: Connection,
  tx: VersionedTransaction
): Promise<void> {
  try {
    const sim = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: false,
      commitment: 'confirmed',
    });
    if (sim.value.err) {
      const logs = sim.value.logs ?? [];
      console.error(
        '[swap-with-fee] simulation failed · err:',
        JSON.stringify(sim.value.err),
        '· logs:',
        logs
      );
      const joined = logs.join(' | ').toLowerCase();
      const errStr = JSON.stringify(sim.value.err).toLowerCase();
      if (joined.includes('insufficient lamports') || errStr.includes('insufficientlamports')) {
        throw new Error('__ERR_INSUFFICIENT_BALANCE');
      }
      if (
        joined.includes('toolittlesolreceived') ||
        joined.includes('slippage') ||
        joined.includes('exceedsdesiredslippage') ||
        joined.includes('toolittlereceived')
      ) {
        throw new Error('__ERR_SLIPPAGE_TOO_LOW');
      }
      if (
        joined.includes('token-2022') ||
        joined.includes('token2022') ||
        (joined.includes('programfailedtocomplete') &&
          joined.includes('tokenkeg') === false &&
          (joined.includes('tokenz') || joined.includes('extension')))
      ) {
        throw new Error('__ERR_TOKEN_2022_INCOMPATIBLE');
      }
      if (errStr.includes('blockhashnotfound') || joined.includes('blockhashnotfound')) {
        throw new Error('__ERR_STALE_BLOCKHASH');
      }
      throw new Error('__ERR_TX_SIMULATION_FAIL');
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message === '__ERR_TX_SIMULATION_FAIL' ||
        e.message === '__ERR_INSUFFICIENT_BALANCE' ||
        e.message === '__ERR_SLIPPAGE_TOO_LOW' ||
        e.message === '__ERR_TOKEN_2022_INCOMPATIBLE' ||
        e.message === '__ERR_STALE_BLOCKHASH')
    ) {
      throw e;
    }
    console.warn('[swap-with-fee] simulate RPC unavailable, proceeding without precheck:', e);
  }
}

// ─── buildSwapTxWithFee · 旧 API · 保留向后兼容 ───

/**
 * 构造带 Ocufi fee 的 swap v0 tx · 旧 API
 *
 * @deprecated T-PHANTOM-SPLIT-TX(2026-04-30):大路由场景必须用 prepareSwapTxs 拆 2 笔;
 *   此 API 只走 single 路径 · split 触发时抛 `__ERR_TX_REQUIRES_SPLIT`,
 *   提示前端切到 prepareSwapTxs。前端 buy/sell-form 切换 follow-up 由 🎨 接 T-PHANTOM-SPLIT-TX-FE。
 *
 * @param feeBps   @deprecated · T-FEE-CONFIG(2026-04-29)起 fee 改 env 驱动,本参数被忽略
 */
export async function buildSwapTxWithFee(
  connection: Connection,
  quote: JupiterQuote,
  userPublicKey: string,
  gasLevel: GasLevel = 'fast',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  feeBps = 10
): Promise<VersionedTransaction> {
  const plan = await prepareSwapTxs(connection, quote, userPublicKey, gasLevel);
  if (plan.kind === 'single') return plan.tx;
  // split 触发 · 旧 API 没法返 2 个 tx · 让前端切到 prepareSwapTxs
  throw new Error('__ERR_TX_REQUIRES_SPLIT');
}
