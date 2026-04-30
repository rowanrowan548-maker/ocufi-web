'use client';

/**
 * T-CHART-FULL-8 · 自家蜡烛图价格单位 zustand(USD | SOL)
 *
 * 默认 USD · 跟 currency-store 区分:这是 chart 内部价格单位 · 不是全站货币
 * SOL 模式时 · 前端用当前 SOL/USD 价反推 · 后端 ohlc 仍返 USD
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ChartUnit = 'USD' | 'SOL';

interface ChartUnitState {
  unit: ChartUnit;
  setUnit: (u: ChartUnit) => void;
}

export const useChartUnitStore = create<ChartUnitState>()(
  persist(
    (set) => ({
      unit: 'USD',
      setUnit: (u) => set({ unit: u }),
    }),
    {
      name: 'ocufi.chartUnit',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return window.localStorage;
      }),
    }
  )
);

export function useChartUnit(): ChartUnit {
  return useChartUnitStore((s) => s.unit);
}

export function useSetChartUnit(): (u: ChartUnit) => void {
  return useChartUnitStore((s) => s.setUnit);
}
