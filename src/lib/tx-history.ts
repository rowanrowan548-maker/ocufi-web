/**
 * 钱包成交历史
 *
 * 数据源:Helius Enhanced Transactions API
 *   GET https://api.helius.xyz/v0/addresses/{owner}/transactions?api-key=XX&limit=30
 *
 * 为什么不用 connection.getParsedTransaction(s):
 *   - Helius 免费版拒 batch RPC(-32403)
 *   - 单笔串行 RPC 也容易被限流(-32413)
 *   - Enhanced API 走独立配额,一次请求拿全部 30 条,直接包含 tokenTransfers/nativeTransfers
 *
 * 分类规则:
 *   - 过滤 owner 参与的 token / SOL 流动
 *   - SOL out + 某 token in  → buy
 *   - 某 token out + SOL in   → sell
 *   - 其他(转入/转出/合约)    → other
 */
import { PublicKey } from '@solana/web3.js';
import { SOL_MINT } from './portfolio';

export type TxType = 'buy' | 'sell' | 'other';

export interface TxRecord {
  signature: string;
  blockTime: number | null;   // 秒级 unix
  slot: number;
  type: TxType;
  tokenMint: string;          // buy/sell 涉及的 SPL mint;other 可能为空
  tokenAmount: number;        // buy:收到;sell:卖掉;正数
  solAmount: number;          // buy:花掉;sell:收到;正数,含 fee
  feeSol: number;
  err: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface HeliusTx {
  signature: string;
  timestamp: number;          // 秒
  slot: number;
  fee: number;                // lamports
  type?: string;              // SWAP / TRANSFER / ...
  transactionError?: unknown;
  tokenTransfers?: Array<{
    fromUserAccount?: string | null;
    toUserAccount?: string | null;
    mint: string;
    tokenAmount: number;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount?: string | null;
    toUserAccount?: string | null;
    amount: number;            // lamports
  }>;
}

/** 从 NEXT_PUBLIC_HELIUS_RPC 的 URL 里抠出 api-key */
function getHeliusApiKey(): string | null {
  try {
    const url = process.env.NEXT_PUBLIC_HELIUS_RPC;
    if (!url) return null;
    return new URL(url).searchParams.get('api-key');
  } catch {
    return null;
  }
}

export async function fetchTxHistory(
  _connection: unknown,            // 保留签名兼容 hook
  owner: PublicKey,
  limit = 30
): Promise<TxRecord[]> {
  const key = getHeliusApiKey();
  if (!key) {
    throw new Error('Helius API key 未配置(缺 NEXT_PUBLIC_HELIUS_RPC)');
  }

  const ownerStr = owner.toBase58();
  const url =
    `https://api.helius.xyz/v0/addresses/${ownerStr}/transactions` +
    `?api-key=${key}&limit=${limit}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Helius Enhanced API ${res.status}: ${await res.text()}`);
  }
  const list: HeliusTx[] = await res.json();

  return list.map((tx) => classifyTx(tx, ownerStr));
}

function classifyTx(tx: HeliusTx, ownerStr: string): TxRecord {
  const feeSol = (tx.fee ?? 0) / 1e9;

  // 算 owner 的 SOL 净变化(含 fee)
  let solDelta = 0;
  for (const n of tx.nativeTransfers ?? []) {
    if (n.fromUserAccount === ownerStr) solDelta -= (n.amount ?? 0) / 1e9;
    if (n.toUserAccount === ownerStr) solDelta += (n.amount ?? 0) / 1e9;
  }

  // 算 owner 每个 token mint 的净变化(过滤 WSOL)
  const tokenDeltas = new Map<string, number>();
  for (const t of tx.tokenTransfers ?? []) {
    if (!t.mint || t.mint === SOL_MINT) continue;
    const amt = Number(t.tokenAmount ?? 0);
    if (t.fromUserAccount === ownerStr) {
      tokenDeltas.set(t.mint, (tokenDeltas.get(t.mint) ?? 0) - amt);
    }
    if (t.toUserAccount === ownerStr) {
      tokenDeltas.set(t.mint, (tokenDeltas.get(t.mint) ?? 0) + amt);
    }
  }

  // 取变化绝对值最大的 mint 作主角
  const entries = [...tokenDeltas.entries()]
    .filter(([, d]) => Math.abs(d) > 1e-12)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const main = entries[0];

  const base = {
    signature: tx.signature,
    blockTime: tx.timestamp ?? null,
    slot: tx.slot,
    feeSol,
    err: !!tx.transactionError,
  };

  if (main && main[1] > 0 && solDelta < -feeSol * 0.5) {
    return {
      ...base,
      type: 'buy',
      tokenMint: main[0],
      tokenAmount: main[1],
      solAmount: Math.abs(solDelta),
    };
  }
  if (main && main[1] < 0 && solDelta > 0) {
    return {
      ...base,
      type: 'sell',
      tokenMint: main[0],
      tokenAmount: Math.abs(main[1]),
      solAmount: solDelta,
    };
  }
  return {
    ...base,
    type: 'other',
    tokenMint: main?.[0] ?? '',
    tokenAmount: main ? Math.abs(main[1]) : 0,
    solAmount: Math.abs(solDelta),
  };
}
