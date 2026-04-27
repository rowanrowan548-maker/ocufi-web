'use client';

/**
 * Solana RPC 健康提示条
 *
 * 数据走链上 hook useRpcHealth(30s 轮询 + tab 不可见暂停 + 连续 down backoff 60s)。
 *
 * 三态:
 *  - healthy / checking → 不渲染(banner 隐身)
 *  - degraded(1-3s 延迟)→ 黄色提示 "网络节点响应较慢"
 *  - down(>3s 或 fail)→ 红色提示 "节点暂不可达,部分功能可能受影响" + 重试按钮
 *
 * 重试:imperative 调用 probeRpc(connection),local override 取代 hook 状态
 * 直到 hook 的下次轮询返回更新的 checkedAt。
 */
import { useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import { AlertCircle, AlertTriangle, RotateCw, Loader2 } from 'lucide-react';
import { useRpcHealth } from '@/hooks/use-rpc-health';
import { probeRpc, type RpcHealthResult } from '@/lib/rpc-health';

export function RpcHealthBanner() {
  const t = useTranslations('trade.rpcHealth');
  const { connection } = useConnection();
  const hookState = useRpcHealth();
  const [override, setOverride] = useState<RpcHealthResult | null>(null);
  const [retrying, setRetrying] = useState(false);

  // 取较新的(checkedAt 大)
  const state =
    override && override.checkedAt > hookState.checkedAt ? override : hookState;

  if (state.health === 'checking') return null;
  if (state.health === 'healthy') return null;

  const isDown = state.health === 'down';
  const cls = isDown
    ? 'bg-danger/10 text-danger border-danger/30'
    : 'bg-warning/10 text-warning border-warning/30';
  const Icon = isDown ? AlertCircle : AlertTriangle;

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      const result = await probeRpc(connection);
      setOverride(result);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      className={`px-3 py-2 text-sm rounded-md border flex items-center gap-2 ${cls}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">
        {isDown ? t('down') : t('slow')}
      </span>
      {isDown && (
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-current/30 hover:bg-current/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retrying ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCw className="h-3 w-3" />
          )}
          <span>{t('retry')}</span>
        </button>
      )}
    </div>
  );
}
