'use client';

/**
 * T-PORTFOLIO-AUTOREFRESH · 跨组件刷新信号
 *
 * 买入/卖出成交后调用 `bumpSwap()` ,所有订阅 `swapVersion` 的 hook
 * (usePortfolio / useTxHistory / use-cost-basis 等)在下一帧 refetch。
 *
 * 用 zustand 而不是 Context 避免每次 bump 触发整个 Provider 子树 re-render
 * (订阅者只读 swapVersion,不订阅其他状态)。
 */
import { create } from 'zustand';

interface SwapRefreshState {
  swapVersion: number;
  bumpSwap: () => void;
}

export const useSwapRefresh = create<SwapRefreshState>((set) => ({
  swapVersion: 0,
  bumpSwap: () => set((s) => ({ swapVersion: s.swapVersion + 1 })),
}));
