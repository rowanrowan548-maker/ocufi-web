/**
 * Birdeye OHLCV 客户端 lib(T-CHAIN-BIRDEYE-OHLCV-LIB)
 *
 * 背景:
 *   - 🎨 即将做 T-CHART-FULL(K 线完整版 · 1 周大件)需要更长历史 / 更精细分钟级
 *   - 后端 chart.py 已有 Birdeye fallback(GT 网络错时自动用 Birdeye),但**默认走 GT**
 *   - 完整版子任务可能需要**强制走 Birdeye**(GT 限速 87.5%,Birdeye 数据更稳)
 *
 * 实现:thin wrapper · 复用 ohlc.ts 的 parser / cache / inflight / stale-while-error
 *   只是把 source 锁死成 'birdeye',传给后端 ?source=birdeye query
 *
 * 后端依赖:
 *   - 后端当前 chart.py **未支持 ?source=birdeye query**(需 🗄️ 加 0.5h 改动)
 *   - 不支持时后端忽略 query 走默认(GT first → Birdeye fallback)→ 跟 fetchOhlc('auto') 等价
 *   - 后端 ship 后 birdeye-client 立即强制走 Birdeye · 前端 / lib 调用方无需改
 *
 * 不破现有 fetchOhlc:
 *   - ohlc.ts 加可选 source 参数,默认 'auto'(原行为)
 *   - 现有 chart-card.tsx 调用 fetchOhlc(mint, tf) 不感知,行为完全一致
 */

import { fetchOhlc, type OhlcCandle, type Timeframe } from './ohlc';

/**
 * 强制走 Birdeye 数据源拉 OHLC · thin wrapper over fetchOhlc
 *
 * 调用 `${NEXT_PUBLIC_API_URL}/chart/ohlc?mint=&tf=&limit=&source=birdeye`
 *
 * @param mint      token mint(base58)
 * @param timeframe UI 枚举('minute_1' / 'hour_4' / 'day_1' 等)
 * @param limit     candle 数 · 默认 200 · max 1000
 * @returns         OhlcCandle[] · 按 time 升序,失败 / 后端不支持时跟 fetchOhlc 默认等同
 */
export async function fetchOhlcvBirdeye(
  mint: string,
  timeframe: Timeframe,
  limit = 200
): Promise<OhlcCandle[]> {
  return fetchOhlc(mint, timeframe, limit, 'birdeye');
}
