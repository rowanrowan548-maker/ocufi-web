'use client';

/**
 * 价格提醒 · 全局轮询 + 触发通知
 *
 * - 每 30s 拉一次所有 active alert 涉及的 mint 的当前价
 * - 命中阈值 → 浏览器 Notification + markTriggered(不重复提醒)
 *
 * 这个 hook 会在 Provider 里挂一次,全站 tab 共享一份 polling
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadAlerts, markTriggered, shouldFire, fireNotification,
  type PriceAlert,
} from '@/lib/alerts';
import { fetchTokensInfoBatch } from '@/lib/portfolio';

const POLL_MS = 30_000;

export interface AlertsState {
  alerts: PriceAlert[];
  prices: Map<string, number>;  // mint → current priceUsd
  loading: boolean;
  /** 强制重新读取 localStorage + 立即拉一次价(新建/删除后调用) */
  refresh: () => void;
}

export function usePriceAlerts(): AlertsState {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // 读 localStorage
  useEffect(() => {
    setAlerts(loadAlerts());
  }, [tick]);

  const activeMints = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) if (!a.triggered) set.add(a.mint);
    return [...set];
  }, [alerts]);

  // 轮询
  useEffect(() => {
    if (activeMints.length === 0) {
      setPrices(new Map());
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      setLoading(true);
      try {
        const infos = await fetchTokensInfoBatch(activeMints);
        if (cancelled) return;
        const p = new Map<string, number>();
        for (const [mint, info] of infos) p.set(mint, info.priceUsd);
        setPrices(p);

        // 对每个 active alert 检查是否触发
        const fresh = loadAlerts();
        let changed = false;
        for (const a of fresh) {
          if (a.triggered) continue;
          const cur = p.get(a.mint);
          if (cur == null) continue;
          if (shouldFire(a, cur)) {
            const dir = a.direction === 'above' ? '涨到' : '跌到';
            fireNotification(
              `${a.symbol} ${dir} $${a.targetUsd}`,
              `当前 $${cur.toPrecision(6)} · 点击查看详情`,
              `${window.location.origin}/token/${a.mint}`
            );
            markTriggered(a.id, cur);
            changed = true;
          }
        }
        if (changed) setAlerts(loadAlerts());
      } catch {
        /* 限速/网络:下轮再试 */
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
  }, [activeMints.join(',')]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { alerts, prices, loading, refresh };
}
