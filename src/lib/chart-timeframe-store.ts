'use client';

/**
 * T-CHART-FULL-2 · 自家蜡烛图 timeframe 持久化(zustand + localStorage)
 *
 * 6 档:1m / 5m / 15m / 1h / 4h / 1d · 默认 5m
 * 跨页面 / 跨 tab 同步 · 跟 currency-store 同结构
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Timeframe } from './ohlc';

interface ChartTfState {
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
}

export const useChartTimeframeStore = create<ChartTfState>()(
  persist(
    (set) => ({
      timeframe: 'minute_5',
      setTimeframe: (tf) => set({ timeframe: tf }),
    }),
    {
      name: 'ocufi.chartTimeframe',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return window.localStorage;
      }),
    }
  )
);

export function useChartTimeframe(): Timeframe {
  return useChartTimeframeStore((s) => s.timeframe);
}

export function useSetChartTimeframe(): (tf: Timeframe) => void {
  return useChartTimeframeStore((s) => s.setTimeframe);
}

export const TIMEFRAMES: Timeframe[] = [
  'minute_1',
  'minute_5',
  'minute_15',
  'hour_1',
  'hour_4',
  'day_1',
];
