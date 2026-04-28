'use client';

/**
 * T-942 #56 · 交易通知留痕
 *
 * 持久化最近 10 笔成交(buy/sell)用于 /watchlist 顶部显示"上一笔交易"。
 * Toast 关闭后还能看到,跨刷新保留。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface TradeNotification {
  id: string;          // signature
  side: 'buy' | 'sell';
  mint: string;
  symbol: string;
  amountSol: number;   // 花费/收回的 SOL
  amountTokens: number;
  signature: string;
  createdAt: number;   // ms
}

interface NotifState {
  list: TradeNotification[];
  push: (n: Omit<TradeNotification, 'id' | 'createdAt'>) => void;
  clear: () => void;
}

const MAX = 10;

export const useTradeNotifications = create<NotifState>()(
  persist(
    (set) => ({
      list: [],
      push: (n) => set((s) => ({
        list: [
          { ...n, id: n.signature, createdAt: Date.now() },
          ...s.list.filter((x) => x.signature !== n.signature),
        ].slice(0, MAX),
      })),
      clear: () => set({ list: [] }),
    }),
    {
      name: 'ocufi.trade-notifications',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** 非 React 上下文也能读 · 用于 buy-form / sell-form 直接 push */
export function pushTradeNotification(n: Omit<TradeNotification, 'id' | 'createdAt'>) {
  useTradeNotifications.getState().push(n);
}
