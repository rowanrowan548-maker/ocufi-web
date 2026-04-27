'use client';

/**
 * T-908b · 全站货币显示单位 store(USD / SOL)
 *
 * - zustand persist localStorage('ocufi.currency')
 * - 配套 hook useCurrency() · 仅订阅 currency 字段,避免无谓重渲
 * - 跨组件同步 + 跨 tab 同步(zustand 自带 localStorage event)
 *
 * 兼容 T-908a 已有的 settings-menu localStorage 写入(同 key),
 * 切换器迁到 setCurrency 后由本 store 接管,但 readCurrency 兜底读
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Currency = 'USD' | 'SOL';

interface CurrencyState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: 'USD',
      setCurrency: (c) => set({ currency: c }),
    }),
    {
      name: 'ocufi.currency',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      // 兼容 T-908a 直接写裸字符串("USD" / "SOL"),迁移到 zustand 的 { state: { currency } } 结构
      onRehydrateStorage: () => (state) => {
        if (typeof window === 'undefined') return;
        try {
          const raw = window.localStorage.getItem('ocufi.currency');
          if (raw === 'USD' || raw === 'SOL') {
            // 老格式 → 升级
            state?.setCurrency(raw);
          }
        } catch {
          /* ignore */
        }
      },
    }
  )
);

/** 读 currency 字段(只订阅这一个,避免 setCurrency 变化引起的重渲) */
export function useCurrency(): Currency {
  return useCurrencyStore((s) => s.currency);
}

export function useSetCurrency(): (c: Currency) => void {
  return useCurrencyStore((s) => s.setCurrency);
}
