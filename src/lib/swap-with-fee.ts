/**
 * 自组 swap tx,在 Jupiter swap 指令前插一条 SystemProgram.transfer 收 fee
 *
 * 动机:Jupiter 官方 Referral 走 Referral Program `REFER4Zg...`,OKX 钱包
 *   风控把这个 program 视为未白名单,preflight 直接拒。改用 Solana 原生
 *   SystemProgram.transfer 收 fee,所有钱包都认。
 *
 * 流程:
 *  1. POST /swap/v1/swap-instructions 拿原始指令数组
 *  2. 构建 instructions 列表:computeBudget + setup + 【我们的 fee ix】+ swap + cleanup
 *  3. fetch 所有 ALT(address lookup table),拼装 v0 VersionedTransaction
 *  4. 返回 tx 给钱包签名
 *
 * V1 收费策略:
 *  - 买入(input = SOL):从用户钱包直接 SystemProgram.transfer 0.1% SOL 到 vault
 *  - 卖出(input = SPL):V1 暂不收(需要 swap 后再转,复杂度高),Day 9 再加
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
import { SOL_MINT } from './portfolio';

const GAS_CONFIG: Record<GasLevel, { priorityLevel: string; maxLamports: number }> = {
  normal: { priorityLevel: 'medium', maxLamports: 5_000 },
  fast: { priorityLevel: 'high', maxLamports: 50_000 },
  turbo: { priorityLevel: 'veryHigh', maxLamports: 1_000_000 },
};

// SPL Memo program v2 · Solana 第一方 program,所有钱包识别
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const OCUFI_FEE_MEMO = 'Ocufi 0.1% trading fee · ocufi.io/fees';

// Token program owner ids · 用于检测 mint 是经典 SPL Token 还是 Token-2022
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

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

/**
 * 构造带 Ocufi fee 的 swap v0 tx
 *
 * @param quote    Jupiter quote(不带 platformFeeBps)
 * @param userPublicKey 用户钱包
 * @param gasLevel 优先级
 * @param feeBps   收费基点,默认 10 = 0.1%(仅买入有效)
 */
export async function buildSwapTxWithFee(
  connection: Connection,
  quote: JupiterQuote,
  userPublicKey: string,
  gasLevel: GasLevel = 'fast',
  feeBps = 10
): Promise<VersionedTransaction> {
  const chain = getCurrentChain();
  const gas = GAS_CONFIG[gasLevel];

  // 0. 卖出场景:广播前用链上实时 ATA 余额做 sanity check,挡住"前端 30s 轮询余额 vs
  //    链上实时余额"的竞态(N3)。仅当「RPC 成功 + 查到余额 > 0 + 小于 quote 要求」
  //    三件事同时成立时抛 __ERR_BALANCE_DRIFT;其他场景静默放行,让 swap 自己 try。
  if (quote.inputMint !== SOL_MINT) {
    let onChainTotal = BigInt(0);
    let probeOk = false;
    try {
      const res = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(userPublicKey),
        { mint: new PublicKey(quote.inputMint) }
      );
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
  //   Jupiter `useSharedAccounts=true`(默认)只支持经典 SPL Token 的 shared ATAs,
  //   遇 Token-2022 mint(如 MEW)会触发 simulate logs:
  //     "Please upgrade to SPL Token 2022 for immutable owner support"
  //   → InstructionError [8, "ProgramFailedToComplete"] → Phantom 红警
  //   解法:检测 swap non-SOL 端 mint 的 owner program,Token-2022 时关 shared accounts。
  //   RPC 失败 → 保守关(确保兼容性,代价是多几 K lamports gas)。
  //   经典 SPL 不受影响,继续享受 shared accounts 优化(省 ~5K lamports)。
  const nonSolMint = quote.inputMint === SOL_MINT ? quote.outputMint : quote.inputMint;
  let useSharedAccounts = true;
  try {
    const info = await connection.getAccountInfo(new PublicKey(nonSolMint));
    if (info && info.owner.toBase58() === TOKEN_2022_PROGRAM_ID) {
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

  // swapUrl 是 /swap,我们要 /swap-instructions
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

  // 2. 组装 instructions
  const instructions: TransactionInstruction[] = [];

  // T-812 · ComputeBudget 策略(经过 T-812-fix → T-812-fix2 演进):
  //   - 经典做法:让 Jupiter 通过 `dynamicComputeUnitLimit: true` 返推荐 SetComputeUnitLimit
  //   - 实测 Jupiter 给的值不可靠:用户测 USDC 时 Jupiter 返 108_709 CU,实际 swap 用了更多
  //     → InstructionError [7, "ComputationalBudgetExceeded"] → simulate 失败 → 红警
  //   - T-812-fix2 决策:**始终强制 1_400_000 CU**(Solana 单 tx 硬上限)
  //     · 过滤掉 Jupiter 返回的 SetComputeUnitLimit(discriminator=2),
  //       保留 SetComputeUnitPrice / RequestHeapFrame 等其他 ComputeBudget ix(priority fee 关联)
  //     · 我们自己 push 一条 setComputeUnitLimit(1_400_000)
  //   - 副作用:无 — Solana priority fee = consumed_CU × microLamportsPerCU,设大不多收钱
  //   - 收益:budget 永远够,彻底关掉 ComputationalBudgetExceeded 这类 simulate 失败
  const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId.toBase58();
  const filteredJupiterBudgetIxs = resp.computeBudgetInstructions.filter((ix) => {
    if (ix.programId !== COMPUTE_BUDGET_PROGRAM_ID) return true;
    const data = Buffer.from(ix.data, 'base64');
    // discriminator 2 = SetComputeUnitLimit · 滤掉,我们自己写死 1.4M
    return !(data.length > 0 && data[0] === 2);
  });
  instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  instructions.push(...filteredJupiterBudgetIxs.map(jsonToIx));
  if (resp.tokenLedgerInstruction) instructions.push(jsonToIx(resp.tokenLedgerInstruction));
  instructions.push(...resp.setupInstructions.map(jsonToIx));

  // 💰 Ocufi fee:仅在买入(input=SOL)且配了 vault 时插入
  const vault = getFeeVault();
  if (vault && quote.inputMint === SOL_MINT && feeBps > 0) {
    const feeLamports = Math.floor((Number(quote.inAmount) * feeBps) / 10_000);
    if (feeLamports > 0) {
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(userPublicKey),
          toPubkey: vault,
          lamports: feeLamports,
        })
      );
      // Memo ix:在 Phantom / Solflare simulation UI 里显示用途文本,
      // 让用户(和 Blowfish)看清楚 fee 转账是"手续费"而非可疑转账。
      // T-601 Mitigation B · 不依赖外部 SDK,手写 Memo program v2 ix。
      // signer = 用户钱包(让 indexer / wallet UI 关联到主调者)
      instructions.push(
        new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [{ pubkey: new PublicKey(userPublicKey), isSigner: true, isWritable: false }],
          data: Buffer.from(OCUFI_FEE_MEMO, 'utf-8'),
        })
      );
    }
  }

  instructions.push(jsonToIx(resp.swapInstruction));
  if (resp.cleanupInstruction) instructions.push(jsonToIx(resp.cleanupInstruction));

  // 3. 加载 ALT
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

  // 4. 组 v0 tx
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: new PublicKey(userPublicKey),
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(alts);

  const tx = new VersionedTransaction(message);

  // 5. T-810 · tx size 自检(Solana mainnet packet 限制 1232 字节)
  //    Jupiter `addressLookupTableAddresses` 已经在 step 3 加载并传给 compileToV0Message,
  //    超限说明 Jupiter 推荐 ALT 已不够 / fee+memo+swap ix 累积过大,需人工调查路由。
  const txSize = tx.serialize().length;
  if (txSize > 1232) {
    console.error(
      `[swap-with-fee] tx size overflow: ${txSize} bytes (limit 1232) · ` +
        `inputMint=${quote.inputMint.slice(0, 8)} outputMint=${quote.outputMint.slice(0, 8)} ` +
        `ALTs=${alts.length} ix=${instructions.length}`
    );
    throw new Error('__ERR_TX_SIZE_OVERFLOW');
  }

  // 6. T-810 · simulateTransaction 自检
  //    Phantom 红警 "malicious" 真因 = Lighthouse / Blowfish 模拟我们的 tx 失败。
  //    自检在签名前抓住 budget / ATA / blockhash 类问题,**不让用户签**,避免红警。
  //    sigVerify=false 因 tx 未签名 · replaceRecentBlockhash=false 用我们刚拿的 blockhash 模拟
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
      // T-972 范围 2:simulation 失败按 logs 分类抛具体 sentinel,前端 mapError 给具体文案
      const joined = logs.join(' | ').toLowerCase();
      const errStr = JSON.stringify(sim.value.err).toLowerCase();
      if (joined.includes('insufficient lamports') || errStr.includes('insufficientlamports')) {
        throw new Error('__ERR_INSUFFICIENT_BALANCE');
      }
      if (joined.includes('toolittlesolreceived') || joined.includes('slippage') ||
          joined.includes('exceedsdesiredslippage') || joined.includes('toolittlereceived')) {
        throw new Error('__ERR_SLIPPAGE_TOO_LOW');
      }
      if (joined.includes('token-2022') || joined.includes('token2022') ||
          (joined.includes('programfailedtocomplete') && joined.includes('tokenkeg') === false &&
           (joined.includes('tokenz') || joined.includes('extension')))) {
        throw new Error('__ERR_TOKEN_2022_INCOMPATIBLE');
      }
      if (errStr.includes('blockhashnotfound') || joined.includes('blockhashnotfound')) {
        throw new Error('__ERR_STALE_BLOCKHASH');
      }
      // 不把 raw simulation log 塞 message,只抛 sentinel(T-813 友好化要求)
      throw new Error('__ERR_TX_SIMULATION_FAIL');
    }
  } catch (e) {
    // 我们自己抛的 sentinel → 透传(T-972 加 4 个细分 sentinel)
    if (e instanceof Error && (
      e.message === '__ERR_TX_SIMULATION_FAIL' ||
      e.message === '__ERR_INSUFFICIENT_BALANCE' ||
      e.message === '__ERR_SLIPPAGE_TOO_LOW' ||
      e.message === '__ERR_TOKEN_2022_INCOMPATIBLE' ||
      e.message === '__ERR_STALE_BLOCKHASH'
    )) throw e;
    // RPC 调用本身失败(timeout / 5xx)→ 不拦 swap,让用户继续尝试(simulate 不可用 ≠ tx 必坏)
    console.warn('[swap-with-fee] simulate RPC unavailable, proceeding without precheck:', e);
  }

  return tx;
}
