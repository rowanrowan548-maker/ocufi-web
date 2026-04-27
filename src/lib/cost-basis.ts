/**
 * 从 TxRecord 历史算每个 mint 的加权平均买入成本
 *
 * 方法:移动加权平均(WAC)
 *   对 tx 按时间正序遍历:
 *     buy:   newAvg = (oldAvg * balance + paidSol) / (balance + receivedTokens)
 *     sell:  avg 保持不变,balance 递减;balance 清零则 reset
 *
 * 局限:
 *   - Helius Enhanced API 只返回最近 100 笔,100 笔之前的成本丢失
 *   - 用 input SOL(含 gas)近似支出,高估一点点(0.001 SOL 量级)
 *   - 成本单位是 SOL,换算 USD 要再乘当前 SOL/USD(忽略 SOL 本身涨跌)
 */
import type { TxRecord } from './tx-history';

export interface CostEntry {
  mint: string;
  /** 当前余额(仅从历史累积推出,可能和链上实时余额不同) */
  derivedBalance: number;
  /** 加权平均成本:每枚 token 花了多少 SOL */
  avgCostSol: number;
  /** 累计买入花的 SOL 总量 */
  totalBoughtSol: number;
  /** 累计买入的 token 总量 */
  totalBoughtTokens: number;
  /** 有几笔 buy 交易 */
  buyCount: number;
  /** 累计卖出收回的 SOL 总量 */
  totalSoldSol: number;
  /** 累计卖出的 token 总量 */
  totalSoldTokens: number;
  /** 有几笔 sell 交易 */
  sellCount: number;
  /** 最近一笔 tx 的 blockTime(秒) */
  lastTxAt: number;
  /** 第一笔 buy 的 blockTime(秒)· T-900b 计算持仓时长 */
  firstBuyAt: number;
}

export interface ClosedPosition {
  mint: string;
  /** 累计买入 SOL */
  totalBoughtSol: number;
  /** 累计买入 tokens */
  totalBoughtTokens: number;
  /** 累计卖出 SOL */
  totalSoldSol: number;
  /** 累计卖出 tokens */
  totalSoldTokens: number;
  /** 已实现盈亏(SOL) */
  realizedPnlSol: number;
  /** 已实现盈亏 % */
  realizedPnlPct: number;
  /** 平均买入价(SOL/token) */
  avgBuyPriceSol: number;
  /** 平均卖出价(SOL/token) */
  avgSellPriceSol: number;
  /** 最后一笔卖出时间(秒) */
  closedAt: number;
}

export function computeCostBasis(records: TxRecord[]): Map<string, CostEntry> {
  // Helius 返回按时间降序,我们要升序遍历
  const sorted = [...records].sort((a, b) => (a.blockTime ?? 0) - (b.blockTime ?? 0));

  const map = new Map<string, CostEntry>();

  for (const r of sorted) {
    if (r.err) continue;
    if (!r.tokenMint) continue;

    const prev = map.get(r.tokenMint) ?? {
      mint: r.tokenMint,
      derivedBalance: 0,
      avgCostSol: 0,
      totalBoughtSol: 0,
      totalBoughtTokens: 0,
      buyCount: 0,
      totalSoldSol: 0,
      totalSoldTokens: 0,
      sellCount: 0,
      lastTxAt: 0,
      firstBuyAt: 0,
    };
    const ts = r.blockTime ?? 0;

    if (r.type === 'buy' && r.tokenAmount > 0 && r.solAmount > 0) {
      const newBalance = prev.derivedBalance + r.tokenAmount;
      const newAvg =
        newBalance > 0
          ? (prev.avgCostSol * prev.derivedBalance + r.solAmount) / newBalance
          : 0;
      map.set(r.tokenMint, {
        ...prev,
        derivedBalance: newBalance,
        avgCostSol: newAvg,
        totalBoughtSol: prev.totalBoughtSol + r.solAmount,
        totalBoughtTokens: prev.totalBoughtTokens + r.tokenAmount,
        buyCount: prev.buyCount + 1,
        lastTxAt: Math.max(prev.lastTxAt, ts),
        firstBuyAt: prev.firstBuyAt > 0 ? prev.firstBuyAt : ts,
      });
    } else if (r.type === 'sell' && r.tokenAmount > 0) {
      const newBalance = Math.max(0, prev.derivedBalance - r.tokenAmount);
      map.set(r.tokenMint, {
        ...prev,
        derivedBalance: newBalance,
        // 余额清零就重置成本(下次重新买入起算)
        avgCostSol: newBalance === 0 ? 0 : prev.avgCostSol,
        totalSoldSol: prev.totalSoldSol + r.solAmount,
        totalSoldTokens: prev.totalSoldTokens + r.tokenAmount,
        sellCount: prev.sellCount + 1,
        lastTxAt: Math.max(prev.lastTxAt, ts),
      });
    } else if ((r.type === 'receive' || r.type === 'send') && r.tokenAmount > 0) {
      // 转入/转出不影响成本(没法知道外部成本),只更新 derivedBalance 方便追
      const delta = r.type === 'receive' ? r.tokenAmount : -r.tokenAmount;
      map.set(r.tokenMint, {
        ...prev,
        derivedBalance: Math.max(0, prev.derivedBalance + delta),
      });
    }
  }

  return map;
}

/**
 * 从 CostEntry 衍生出已平仓列表
 *
 * 平仓判定:
 *  - 至少一次买入 + 一次卖出
 *  - derivedBalance ≈ 0(<= 总买入 1% 视为平仓,允许浮点 / 灰尘误差)
 *
 * 已实现 PnL = totalSoldSol - totalBoughtSol(SOL 计价)
 */
export function getClosedPositions(costs: Map<string, CostEntry>): ClosedPosition[] {
  const out: ClosedPosition[] = [];
  for (const c of costs.values()) {
    if (c.buyCount === 0 || c.sellCount === 0) continue;
    if (c.totalBoughtTokens <= 0) continue;
    const dustTolerance = c.totalBoughtTokens * 0.01;
    if (c.derivedBalance > dustTolerance) continue;

    const realizedPnlSol = c.totalSoldSol - c.totalBoughtSol;
    const realizedPnlPct =
      c.totalBoughtSol > 0 ? (realizedPnlSol / c.totalBoughtSol) * 100 : 0;
    const avgBuyPriceSol =
      c.totalBoughtTokens > 0 ? c.totalBoughtSol / c.totalBoughtTokens : 0;
    const avgSellPriceSol =
      c.totalSoldTokens > 0 ? c.totalSoldSol / c.totalSoldTokens : 0;

    out.push({
      mint: c.mint,
      totalBoughtSol: c.totalBoughtSol,
      totalBoughtTokens: c.totalBoughtTokens,
      totalSoldSol: c.totalSoldSol,
      totalSoldTokens: c.totalSoldTokens,
      realizedPnlSol,
      realizedPnlPct,
      avgBuyPriceSol,
      avgSellPriceSol,
      closedAt: c.lastTxAt,
    });
  }
  // 按平仓时间倒序
  out.sort((a, b) => b.closedAt - a.closedAt);
  return out;
}
