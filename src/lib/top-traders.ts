/**
 * 从 GeckoTerminal trades 列表聚合每个 maker 的统计(/trade 底部 Top Traders tab 用)
 *
 * 纯函数,无 fetch,不缓存 — 调用方传入 activity-board 已经拉好的 trades 数组即可。
 *
 * 注意 GTTrade 的字段是 `fromAddress`(实际链上 tx_from_address),
 * SPEC 写的 maker_address 是泛指。
 */
import type { GTTrade } from './geckoterminal';

export interface TraderStats {
  address: string;
  /** 该地址在传入 trades 里出现次数 */
  txCount: number;
  buyCount: number;
  sellCount: number;
  /** 该地址累计 USD 流量(buy + sell 求和绝对值) */
  totalUsdVolume: number;
  /** 净流入 = buy USD − sell USD;正数 = 净买,负数 = 净卖 */
  netUsd: number;
  /** 预留:对比 RugCheck topHolders 看是否大持仓。V1 不计算 */
  isInsider?: boolean;
}

/**
 * 按 fromAddress 聚合 trades,返回按 totalUsdVolume desc 的 Top N
 *
 * @param trades 来自 GeckoTerminal 的成交流(activity-board 已拉)
 * @param topN   返回前 N 名,默认 10
 * @returns      聚合后的 TraderStats[](可能少于 topN,如 trades 不足)
 */
export function aggregateTraders(trades: GTTrade[], topN = 10): TraderStats[] {
  if (!Array.isArray(trades) || trades.length === 0) return [];

  const acc = new Map<string, TraderStats>();
  for (const t of trades) {
    const addr = t.fromAddress;
    if (!addr) continue;        // 缺地址直接跳,不计入

    let s = acc.get(addr);
    if (!s) {
      s = {
        address: addr,
        txCount: 0,
        buyCount: 0,
        sellCount: 0,
        totalUsdVolume: 0,
        netUsd: 0,
      };
      acc.set(addr, s);
    }

    const usd = Number.isFinite(t.usdValue) ? t.usdValue : 0;
    s.txCount += 1;
    s.totalUsdVolume += usd;
    if (t.kind === 'buy') {
      s.buyCount += 1;
      s.netUsd += usd;
    } else {
      s.sellCount += 1;
      s.netUsd -= usd;
    }
  }

  return Array.from(acc.values())
    .sort((a, b) => b.totalUsdVolume - a.totalUsdVolume)
    .slice(0, topN);
}
