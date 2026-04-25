'use client';

/**
 * 30s 自动刷新一次的优先费采样
 * 拉不到时返回 null,UI 走 i18n 静态文案 fallback
 */
import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { fetchPriorityFees, type PriorityFeeBreakdown } from '@/lib/priority-fees';

const REFRESH_MS = 30_000;

export function usePriorityFees(): PriorityFeeBreakdown | null {
  const { connection } = useConnection();
  const [data, setData] = useState<PriorityFeeBreakdown | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const next = await fetchPriorityFees(connection);
      if (!cancelled && next) setData(next);
    };

    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connection]);

  return data;
}
