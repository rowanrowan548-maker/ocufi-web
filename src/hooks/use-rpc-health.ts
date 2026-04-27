'use client';

/**
 * 订阅 Solana RPC 健康状态
 *
 * 30s 轮询(默认)+ 连续失败 ≥ 2 次时 backoff 到 60s
 * tab 不可见时暂停轮询;切回时立即 catch up
 *
 * 完整 SPEC: .coordination/SPECS/T-201-rpc-health-banner.md
 */
import { useEffect, useRef, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { probeRpc, sanitizeEndpoint, isPublicSolanaRpc, type RpcHealthResult } from '@/lib/rpc-health';

const DEFAULT_INTERVAL_MS = 30_000;
const BACKOFF_INTERVAL_MS = 60_000;
const BACKOFF_AFTER_DOWN_COUNT = 2;

export function useRpcHealth(intervalMs: number = DEFAULT_INTERVAL_MS): RpcHealthResult {
  const { connection } = useConnection();
  const endpoint = connection.rpcEndpoint;

  const [state, setState] = useState<RpcHealthResult>(() => ({
    health: 'checking',
    checkedAt: 0,
    endpointLabel: sanitizeEndpoint(endpoint),
    isPublicFallback: isPublicSolanaRpc(endpoint),
  }));

  // ref 避免 effect deps 抖动 + 让 visibility 回调拿到最新值
  const downStreakRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    downStreakRef.current = 0;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const tick = async () => {
      if (cancelledRef.current) return;
      const result = await probeRpc(connection);
      if (cancelledRef.current) return;

      if (result.health === 'down') {
        downStreakRef.current += 1;
      } else {
        downStreakRef.current = 0;
      }
      setState(result);

      if (cancelledRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        // 不排队下次,等 visibility 回 visible 时由 onVisibilityChange 触发
        return;
      }
      const next =
        downStreakRef.current >= BACKOFF_AFTER_DOWN_COUNT ? BACKOFF_INTERVAL_MS : intervalMs;
      timerRef.current = setTimeout(tick, next);
    };

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        // 切回 tab 时立即重探一次,clear 已有 timer 防并发
        clearTimer();
        void tick();
      } else {
        clearTimer();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    void tick();

    return () => {
      cancelledRef.current = true;
      clearTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [connection, intervalMs]);

  return state;
}
