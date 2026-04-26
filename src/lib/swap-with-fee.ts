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

  // 1. 拿 Jupiter 原始指令
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    quoteResponse: quote,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
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
  instructions.push(...resp.computeBudgetInstructions.map(jsonToIx));
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

  return new VersionedTransaction(message);
}
