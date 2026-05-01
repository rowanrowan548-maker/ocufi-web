/**
 * T-FE-PERF-V2-PREFETCH · 路由 hover/touch 预取 helper
 *
 * 目标:用户切币种感觉"瞬间出"(背景:V1 切币 ~2.5s)
 *   - markets 行 hover → 提前拉 audit-card + price + token-info
 *   - header search 结果 hover → 同上
 *   - 1-3s 内用户真点 → 已在 cache · 跳 /trade 直接出
 *
 * 设计:
 *   - 全部 fire-and-forget(`.catch(noop)` 静默 · 失败也不影响 UI · 真组件 mount 时再走正常 fetch)
 *   - 复用各 fetcher 自带的 module cache + inflight dedup:
 *     · fetchPrice(60s cache · inflight)· 同 mint 多次 hover 只调 1 次
 *     · fetchTokenAuditCard(60s cache · inflight)
 *     · fetchTokenInfo(portfolio.ts 内部 cache · 30s)
 *   - 节流:同一 mint 1.5s 内不重复触发(防 hover 抖动 / 滑过几行触发 N 个 prefetch 浪费 quota)
 *
 * 不引新 lib · 不动现有 fetcher 接口 · 只是"何时调"的优化。
 *
 * 不预取的事:
 *   - K 线 OHLC:候选数据点多 · 缓存命中率低 · 用户真点才拉
 *   - smart-money / pool-stats:lazy load 已在 IntersectionObserver 触发 · 不要重复
 */
import { fetchPrice, fetchTokenAuditCard, isApiConfigured } from '@/lib/api-client';
import { fetchTokenInfo } from '@/lib/portfolio';

const noop = () => {};
const THROTTLE_MS = 1_500;
const lastFiredAt = new Map<string, number>();

/**
 * 预取交易页关键数据 · 用户 hover/touch 候选 token 时调
 *
 * 并发拉:price / audit-card / token-info(用户切到 /trade 时这三件套都要)
 * 节流:同 mint 1.5s 内只触发一次
 */
export function prefetchTokenForTrade(mint: string): void {
  if (!mint) return;
  if (!isApiConfigured()) return;
  const now = Date.now();
  const last = lastFiredAt.get(mint) ?? 0;
  if (now - last < THROTTLE_MS) return;
  lastFiredAt.set(mint, now);

  // 全部 fire-and-forget · cache 命中时本身就是 noop
  fetchPrice(mint).catch(noop);
  fetchTokenAuditCard(mint).catch(noop);
  fetchTokenInfo(mint).catch(noop);
}

/**
 * 测试 / 调试用 · 清节流表 · vitest 用
 */
export function _resetPrefetchThrottle(): void {
  lastFiredAt.clear();
}
