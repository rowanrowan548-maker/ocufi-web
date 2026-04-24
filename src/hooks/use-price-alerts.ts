'use client';

/**
 * 价格提醒 hook (Day 11: 迁到后端)
 *
 * - 后端 worker 每 60s 轮询价格 + 标记 triggered
 * - 前端每 20s 拉一次 /alerts?wallet=X,发现新 triggered 未 ack 的就弹通知 + ack
 */
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import {
  listAlerts, ackAlert, isApiConfigured,
  type ApiPriceAlert,
} from '@/lib/api-client';
import { fireNotification } from '@/lib/alerts';

const POLL_MS = 20_000;

export interface AlertsState {
  alerts: ApiPriceAlert[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePriceAlerts(): AlertsState {
  const t = useTranslations();
  const { publicKey } = useWallet();
  const [alerts, setAlerts] = useState<ApiPriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const wallet = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!isApiConfigured() || !wallet) {
      setAlerts([]);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      setLoading(true);
      try {
        const list = await listAlerts(wallet);
        if (cancelled) return;
        setAlerts(list);
        setError(null);

        // 对每个 triggered && !acknowledged 的弹通知 + ack
        for (const a of list) {
          if (a.triggered && !a.acknowledged) {
            const dir = a.direction === 'above' ? '涨到' : '跌到';
            const cur = a.triggered_price_usd ?? 0;
            fireNotification(
              `${a.symbol || a.mint.slice(0, 6)} ${dir} $${a.target_usd}`,
              `${t('alerts.notif.hit', { price: cur.toPrecision(6) })}`,
              `${typeof window !== 'undefined' ? window.location.origin : ''}/token/${a.mint}`
            );
            ackAlert(wallet, a.id).catch(() => {});
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [wallet, tick, t]);

  return { alerts, loading, error, refresh };
}
