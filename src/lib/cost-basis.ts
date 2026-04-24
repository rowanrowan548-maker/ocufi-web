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
    };

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
      });
    } else if (r.type === 'sell' && r.tokenAmount > 0) {
      const newBalance = Math.max(0, prev.derivedBalance - r.tokenAmount);
      map.set(r.tokenMint, {
        ...prev,
        derivedBalance: newBalance,
        // 余额清零就重置成本(下次重新买入起算)
        avgCostSol: newBalance === 0 ? 0 : prev.avgCostSol,
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
