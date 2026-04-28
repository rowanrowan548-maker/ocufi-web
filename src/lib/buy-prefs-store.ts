'use client';

/**
 * T-925 · 买入二次确认偏好(快速模式 + 24h skip)
 *
 * - fastMode:true → 永久跳过买入确认弹窗(老手用)
 * - skipUntilMs:某个时间戳之前都跳过(由弹窗内"下次跳过 24h"复选框写入)
 * - 都是 zustand persist,跨 tab 自动同步
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 共用 jupiter.ts 已 export 的 GasLevel,避免重复定义
import type { GasLevel } from './jupiter';

interface BuyPrefsState {
  fastMode: boolean;
  skipUntilMs: number; // 0 = 不跳过
  // T-929-cont #143:默认优先费档(buy-form 初始化用)
  defaultGasLevel: GasLevel;
  // T-929-cont #144:快捷买入金额 3 档(SOL)
  buyAmounts: [number, number, number];
  setFastMode: (v: boolean) => void;
  setSkipFor24h: () => void;
  setDefaultGasLevel: (v: GasLevel) => void;
  setBuyAmounts: (v: [number, number, number]) => void;
  shouldSkip: () => boolean;
}

export const useBuyPrefsStore = create<BuyPrefsState>()(
  persist(
    (set, get) => ({
      fastMode: false,
      skipUntilMs: 0,
      defaultGasLevel: 'fast',
      buyAmounts: [0.1, 0.5, 1] as [number, number, number],
      setFastMode: (v) => set({ fastMode: v }),
      setSkipFor24h: () => set({ skipUntilMs: Date.now() + 24 * 60 * 60 * 1000 }),
      setDefaultGasLevel: (v) => set({ defaultGasLevel: v }),
      setBuyAmounts: (v) => set({ buyAmounts: v }),
      shouldSkip: () => {
        const s = get();
        if (s.fastMode) return true;
        return s.skipUntilMs > Date.now();
      },
    }),
    {
      name: 'ocufi.buyPrefs',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return window.localStorage;
      }),
    }
  )
);

export function useFastMode(): boolean {
  return useBuyPrefsStore((s) => s.fastMode);
}

export function useSetFastMode(): (v: boolean) => void {
  return useBuyPrefsStore((s) => s.setFastMode);
}

export function useDefaultGasLevel(): GasLevel {
  return useBuyPrefsStore((s) => s.defaultGasLevel);
}

export function useSetDefaultGasLevel(): (v: GasLevel) => void {
  return useBuyPrefsStore((s) => s.setDefaultGasLevel);
}

export function useBuyAmounts(): [number, number, number] {
  return useBuyPrefsStore((s) => s.buyAmounts);
}

export function useSetBuyAmounts(): (v: [number, number, number]) => void {
  return useBuyPrefsStore((s) => s.setBuyAmounts);
}

/** 检查当前是否应该跳过弹窗 — 客户端调用 */
export function shouldSkipBuyConfirm(): boolean {
  return useBuyPrefsStore.getState().shouldSkip();
}

export function markSkipFor24h(): void {
  useBuyPrefsStore.getState().setSkipFor24h();
}
