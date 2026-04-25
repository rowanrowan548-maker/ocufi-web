/**
 * 链上拉前 N 持有者
 *
 * 思路:
 *  1. 优先 getProgramAccounts(SPL Token Program) 过滤 mint,客户端排序取 top N
 *     - 需要 Helius 等支持 getProgramAccounts 的 RPC(公共 mainnet-beta 不支持)
 *     - dataSlice 只取 owner+amount,40 byte/account,带宽可控
 *  2. 失败回落 getTokenLargestAccounts(标准 RPC,只返回 top 20)
 *
 * 安全防护:
 *  - 15s timeout(getProgramAccounts 在大币种很慢,避免无限等)
 *  - 内存缓存 5 分钟(同 mint 反复点 tab 不重复打 RPC)
 */
import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const HOLDER_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

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
  limit = 100
): Promise<Holder[]> {
  const key = `${mint}:${limit}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.holders;

  const mintPk = new PublicKey(mint);

  // 取总供给(用于算 pct)
  const supplyPromise = connection.getTokenSupply(mintPk).catch(() => null);

  let holders: Holder[] = [];

  // ── 路径 A:getProgramAccounts(完整 top N) ──
  try {
    const accounts = await Promise.race([
      connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
        commitment: 'confirmed',
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 0, bytes: mint } },
        ],
        // owner @ offset 32 (32B) + amount @ offset 64 (8B) = 40B
        dataSlice: { offset: 32, length: 40 },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('gpa-timeout')), FETCH_TIMEOUT_MS)
      ),
    ]);

    const parsed = accounts.map((a) => {
      const data = a.account.data as Buffer;
      const owner = new PublicKey(data.subarray(0, 32)).toBase58();
      const amountRaw = data.readBigUInt64LE(32);
      return {
        account: a.pubkey.toBase58(),
        owner,
        amountRaw,
      };
    });
    parsed.sort((a, b) => (b.amountRaw > a.amountRaw ? 1 : -1));

    const supply = await supplyPromise;
    const total = supply?.value?.amount ? BigInt(supply.value.amount) : BigInt(0);

    holders = parsed.slice(0, limit).map((h) => ({
      account: h.account,
      owner: h.owner,
      amountRaw: h.amountRaw.toString(),
      pct: total > BigInt(0)
        ? Number((h.amountRaw * BigInt(1_000_000)) / total) / 10_000
        : 0,
    }));
  } catch {
    // 路径 B:回落到 getTokenLargestAccounts(top 20)
    try {
      const largest = await connection.getTokenLargestAccounts(mintPk);
      const supply = await supplyPromise;
      const total = supply?.value?.amount ? BigInt(supply.value.amount) : BigInt(0);
      // 先把 token account → owner 解析(并行)
      const owners = await Promise.all(
        largest.value.slice(0, limit).map(async (acc) => {
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
      holders = largest.value.slice(0, limit).map((acc, i) => {
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
    } catch {
      holders = [];
    }
  }

  cache.set(key, { holders, expiresAt: Date.now() + HOLDER_TTL_MS });
  return holders;
}
