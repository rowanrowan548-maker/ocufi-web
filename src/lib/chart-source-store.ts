'use client';

/**
 * T-CHART-FULL-10 · chart 数据源 zustand(GT iframe | 自家蜡烛图)
 *
 * 默认 'gt'(稳定先行)· 用户切到 'self' 后持久化 · 切回不丢选择
 * 1 个月稳定 + 用户实测无 bug 后 · 把默认改 'self'(spec 留的渐进升级路径)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ChartSource = 'gt' | 'self';

interface ChartSourceState {
  source: ChartSource;
  setSource: (s: ChartSource) => void;
}

export const useChartSourceStore = create<ChartSourceState>()(
  persist(
    (set) => ({
      source: 'gt',
      setSource: (s) => set({ source: s }),
    }),
    {
      name: 'ocufi.chartSource',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return window.localStorage;
      }),
    }
  )
);

export function useChartSource(): ChartSource {
  return useChartSourceStore((s) => s.source);
}

export function useSetChartSource(): (s: ChartSource) => void {
  return useChartSourceStore((s) => s.setSource);
}
