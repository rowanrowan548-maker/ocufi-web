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

export type TxType =
  | 'buy'
  | 'sell'
  | 'receive'
  | 'send'
  | 'nft_airdrop'   // cNFT / NFT mint 收到
  | 'nft'           // 其他 NFT 操作
  | 'other';

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
  /** Helius 一句话描述(NFT 空投类交易兜底显示这行) */
  description?: string;
  /** NFT 元数据(type=nft_airdrop/nft 时有) */
  nftName?: string;
}

interface HeliusTx {
  signature: string;
  timestamp: number;          // 秒
  slot: number;
  fee: number;                // lamports
  type?: string;              // SWAP / TRANSFER / COMPRESSED_NFT_MINT / ...
  description?: string;
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
  events?: {
    compressed?: Array<{
      newLeafOwner?: string;
      metadata?: { name?: string; symbol?: string };
    }>;
    nft?: {
      amount?: number;
      buyer?: string;
      seller?: string;
      nfts?: Array<{ mint: string; tokenStandard?: string }>;
    };
  };
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
  const base = {
    signature: tx.signature,
    blockTime: tx.timestamp ?? null,
    slot: tx.slot,
    feeSol,
    err: !!tx.transactionError,
    description: tx.description,
  };

  // 压缩 NFT / 普通 NFT 空投(Jupiter Reward 这类):Helius 已分好类,直接用 tx.type
  const cnft = tx.events?.compressed?.find((c) => c.newLeafOwner === ownerStr);
  if (cnft || tx.type === 'COMPRESSED_NFT_MINT') {
    return {
      ...base,
      type: 'nft_airdrop',
      tokenMint: '',
      tokenAmount: 0,
      solAmount: 0,
      nftName: cnft?.metadata?.name,
    };
  }
  if (tx.type && /^NFT_/.test(tx.type)) {
    return {
      ...base,
      type: 'nft',
      tokenMint: '',
      tokenAmount: 0,
      solAmount: 0,
    };
  }

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

  const entries = [...tokenDeltas.entries()]
    .filter(([, d]) => Math.abs(d) > 1e-12)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const posTokens = entries.filter(([, d]) => d > 0);
  const negTokens = entries.filter(([, d]) => d < 0);

  const DUST_SOL = 0.002; // 低于这个数的 SOL 变化当作"没动"(gas/rent 噪声)

  // 买入:SOL 净流出 + 某 token 净流入
  if (posTokens.length > 0 && solDelta < -DUST_SOL) {
    const [mint, amt] = posTokens[0];
    return { ...base, type: 'buy', tokenMint: mint, tokenAmount: amt, solAmount: Math.abs(solDelta) };
  }
  // 卖出:某 token 净流出 + SOL 净流入
  if (negTokens.length > 0 && solDelta > DUST_SOL) {
    const [mint, amt] = negTokens[0];
    return { ...base, type: 'sell', tokenMint: mint, tokenAmount: Math.abs(amt), solAmount: solDelta };
  }
  // 转入:SOL 进来(无 token 交互),或 token 进来(无 SOL 流出)
  if (entries.length === 0 && solDelta > DUST_SOL) {
    return { ...base, type: 'receive', tokenMint: '', tokenAmount: 0, solAmount: solDelta };
  }
  if (posTokens.length > 0 && negTokens.length === 0 && Math.abs(solDelta) <= DUST_SOL) {
    const [mint, amt] = posTokens[0];
    return { ...base, type: 'receive', tokenMint: mint, tokenAmount: amt, solAmount: 0 };
  }
  // 转出:SOL 出去(无 token 交互),或 token 出去(无 SOL 进来)
  if (entries.length === 0 && solDelta < -DUST_SOL) {
    return { ...base, type: 'send', tokenMint: '', tokenAmount: 0, solAmount: Math.abs(solDelta) };
  }
  if (negTokens.length > 0 && posTokens.length === 0 && Math.abs(solDelta) <= DUST_SOL) {
    const [mint, amt] = negTokens[0];
    return { ...base, type: 'send', tokenMint: mint, tokenAmount: Math.abs(amt), solAmount: 0 };
  }
  // 其他(合约交互/关账户/复杂 swap etc):至少把 SOL 差额显示出来
  const main = entries[0];
  return {
    ...base,
    type: 'other',
    tokenMint: main?.[0] ?? '',
    tokenAmount: main ? Math.abs(main[1]) : 0,
    solAmount: Math.abs(solDelta),
  };
}
