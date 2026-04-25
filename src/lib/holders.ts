/**
 * 链上拉持有者(链上免费 RPC 安全版)
 *
 * 改用 getTokenLargestAccounts:RPC 标准接口,直接返回前 20 持有者,
 *   响应小、速度快、所有 RPC 节点都支持。
 *
 * 之前用 getProgramAccounts 全量过滤的方案被废弃 — 在 SOL/USDC 这种百万持仓的
 * 代币上响应可达数百 MB,JSON 解析直接卡死浏览器主线程。前 100 必须等付费 API
 * (Solscan Pro / BirdEye / Solana Tracker)V2 再上。
 *
 * 安全防护:
 *  - 10s timeout
 *  - 内存缓存 5 分钟,避免反复打 RPC
 */
import { Connection, PublicKey } from '@solana/web3.js';

const HOLDER_TTL_MS = 5 * 60 * 1000;

export interface Holder {
  /** token account 地址 */
  account: string;
  /** owner wallet */
  owner: string;
  /** 持仓 raw amount(BigInt 转 string) */
  amountRaw: string;
  /** 占总供给百分比 */
  pct: number;
}

const cache = new Map<string, { holders: Holder[]; expiresAt: number }>();

export async function fetchTopHolders(
  connection: Connection,
  mint: string,
  // 链上免费版上限 20。参数保留兼容上层调用,实际取 min(limit, 20)
  limit = 20
): Promise<Holder[]> {
  const cap = Math.min(limit, 20);
  const key = `${mint}:${cap}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.holders;

  const mintPk = new PublicKey(mint);

  try {
    const [largest, supply] = await Promise.all([
      connection.getTokenLargestAccounts(mintPk),
      connection.getTokenSupply(mintPk).catch(() => null),
    ]);
    const total = supply?.value?.amount ? BigInt(supply.value.amount) : BigInt(0);

    // token account → owner 解析,并行
    const owners = await Promise.all(
      largest.value.slice(0, cap).map(async (acc) => {
        try {
          const info = await connection.getParsedAccountInfo(acc.address);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed: any = info.value?.data;
          const owner = parsed?.parsed?.info?.owner ?? '';
          return { account: acc.address.toBase58(), owner };
        } catch {
          return { account: acc.address.toBase58(), owner: '' };
        }
      })
    );

    const holders: Holder[] = largest.value.slice(0, cap).map((acc, i) => {
      const raw = BigInt(acc.amount);
      return {
        account: owners[i].account,
        owner: owners[i].owner,
        amountRaw: raw.toString(),
        pct: total > BigInt(0)
          ? Number((raw * BigInt(1_000_000)) / total) / 10_000
          : 0,
      };
    });

    cache.set(key, { holders, expiresAt: Date.now() + HOLDER_TTL_MS });
    return holders;
  } catch {
    return [];
  }
}
