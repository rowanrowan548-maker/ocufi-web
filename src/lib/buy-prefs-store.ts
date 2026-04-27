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

interface BuyPrefsState {
  fastMode: boolean;
  skipUntilMs: number; // 0 = 不跳过
  setFastMode: (v: boolean) => void;
  setSkipFor24h: () => void;
  shouldSkip: () => boolean;
}

export const useBuyPrefsStore = create<BuyPrefsState>()(
  persist(
    (set, get) => ({
      fastMode: false,
      skipUntilMs: 0,
      setFastMode: (v) => set({ fastMode: v }),
      setSkipFor24h: () => set({ skipUntilMs: Date.now() + 24 * 60 * 60 * 1000 }),
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

/** 检查当前是否应该跳过弹窗 — 客户端调用 */
export function shouldSkipBuyConfirm(): boolean {
  return useBuyPrefsStore.getState().shouldSkip();
}

export function markSkipFor24h(): void {
  useBuyPrefsStore.getState().setSkipFor24h();
}
