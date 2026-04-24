/**
 * 从链上拉取钱包最近成交,识别出买入/卖出
 *
 * 流程:
 * 1. getSignaturesForAddress(owner, limit) → 最近 N 笔 signature
 * 2. getParsedTransactions(sigs) 批量拿细节
 * 3. 对每笔交易:
 *    - 比较 signer 在 preBalances / postBalances 的 SOL 变化
 *    - 比较 preTokenBalances / postTokenBalances 里 owner 持有 mint 的 uiAmount 变化
 *    - solDelta < 0 且某 token Δ > 0  → buy
 *    - solDelta > 0 且某 token Δ < 0  → sell
 *    - 其他                            → other(转入/转出/合约交互)
 *
 * 注意:
 * - WSOL(So11111111111111111111111111111111111111112)不算 token,属 SOL 内部包裹
 * - feeSol 已经算在 solDelta 里(post 减 pre 天然含 fee)
 */
import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  TransactionSignature,
} from '@solana/web3.js';
import { SOL_MINT } from './portfolio';

export type TxType = 'buy' | 'sell' | 'other';

export interface TxRecord {
  signature: TransactionSignature;
  blockTime: number | null;      // 秒级 unix
  slot: number;
  type: TxType;
  /** 对 buy/sell:涉及的 SPL mint;other 为空串 */
  tokenMint: string;
  /** buy: 收到的 token 数量(正);sell: 卖掉的 token 数量(正) */
  tokenAmount: number;
  /** buy: 花掉的 SOL(正);sell: 收到的 SOL(正);含网络费 */
  solAmount: number;
  feeSol: number;
  err: boolean;
}

export async function fetchTxHistory(
  connection: Connection,
  owner: PublicKey,
  limit = 50
): Promise<TxRecord[]> {
  // 1. 签名列表
  const sigs = await connection.getSignaturesForAddress(owner, { limit });
  if (sigs.length === 0) return [];

  // 2. 批量 parsed(分批,避免 RPC 一次太多)
  const signatures = sigs.map((s) => s.signature);
  const BATCH = 20;
  const parsed: (ParsedTransactionWithMeta | null)[] = [];
  for (let i = 0; i < signatures.length; i += BATCH) {
    const batch = signatures.slice(i, i + BATCH);
    try {
      const res = await connection.getParsedTransactions(batch, {
        maxSupportedTransactionVersion: 0,
      });
      parsed.push(...res);
    } catch (e) {
      console.warn('[tx-history] batch failed:', e);
      for (let j = 0; j < batch.length; j++) parsed.push(null);
    }
  }

  // 3. 解析
  const records: TxRecord[] = [];
  const ownerStr = owner.toBase58();
  for (let i = 0; i < sigs.length; i++) {
    const info = sigs[i];
    const tx = parsed[i];
    const base = {
      signature: info.signature,
      blockTime: info.blockTime ?? null,
      slot: info.slot,
      err: !!info.err,
    };
    if (!tx || !tx.meta || tx.meta.err) {
      records.push({
        ...base,
        type: 'other',
        tokenMint: '',
        tokenAmount: 0,
        solAmount: 0,
        feeSol: (tx?.meta?.fee ?? 0) / 1e9,
        err: true,
      });
      continue;
    }
    const rec = classifyTx(tx, ownerStr);
    records.push({ ...base, ...rec });
  }

  return records;
}

function classifyTx(
  tx: ParsedTransactionWithMeta,
  ownerStr: string
): Omit<TxRecord, 'signature' | 'blockTime' | 'slot' | 'err'> {
  const meta = tx.meta!;
  const keys = tx.transaction.message.accountKeys;
  const ownerIdx = keys.findIndex((k) => k.pubkey.toBase58() === ownerStr);
  const feeSol = (meta.fee ?? 0) / 1e9;

  // SOL 变化(含 fee)
  let solDelta = 0;
  if (ownerIdx >= 0) {
    const pre = meta.preBalances[ownerIdx] ?? 0;
    const post = meta.postBalances[ownerIdx] ?? 0;
    solDelta = (post - pre) / 1e9;
  }

  // token 变化:聚合 owner 持有的每个 mint(跳过 WSOL)
  const preMap = new Map<string, number>();
  const postMap = new Map<string, number>();
  for (const b of meta.preTokenBalances ?? []) {
    if (b.owner !== ownerStr) continue;
    if (b.mint === SOL_MINT) continue;
    preMap.set(b.mint, (preMap.get(b.mint) ?? 0) + Number(b.uiTokenAmount.uiAmount ?? 0));
  }
  for (const b of meta.postTokenBalances ?? []) {
    if (b.owner !== ownerStr) continue;
    if (b.mint === SOL_MINT) continue;
    postMap.set(b.mint, (postMap.get(b.mint) ?? 0) + Number(b.uiTokenAmount.uiAmount ?? 0));
  }
  const mints = new Set([...preMap.keys(), ...postMap.keys()]);
  const deltas: Array<{ mint: string; delta: number }> = [];
  for (const m of mints) {
    const d = (postMap.get(m) ?? 0) - (preMap.get(m) ?? 0);
    if (Math.abs(d) > 1e-12) deltas.push({ mint: m, delta: d });
  }

  // 取变化绝对值最大的那笔作主角
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const main = deltas[0];

  if (main && main.delta > 0 && solDelta < -feeSol * 0.5) {
    return {
      type: 'buy',
      tokenMint: main.mint,
      tokenAmount: main.delta,
      solAmount: Math.abs(solDelta),
      feeSol,
    };
  }
  if (main && main.delta < 0 && solDelta > 0) {
    return {
      type: 'sell',
      tokenMint: main.mint,
      tokenAmount: Math.abs(main.delta),
      solAmount: solDelta,
      feeSol,
    };
  }
  return {
    type: 'other',
    tokenMint: main?.mint ?? '',
    tokenAmount: main ? Math.abs(main.delta) : 0,
    solAmount: Math.abs(solDelta),
    feeSol,
  };
}
