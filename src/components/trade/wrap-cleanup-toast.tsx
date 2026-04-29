'use client';

/**
 * T-PHANTOM-SPLIT-TX-FE · wrap cleanup 提示 toast(只挂 1 次 · 检测到才弹)
 *
 * trade 页面挂这个组件 · mount 时检查 localStorage pendingWrap · 有就 toast。
 * 用户点 toast action → 跳 Solscan 看 setup tx · 自己手动 unwrap(V1 简版)。
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { readPendingWrap, clearPendingWrap } from '@/lib/wrap-cleanup';
import { getCurrentChain } from '@/config/chains';

export function WrapCleanupToast() {
  const t = useTranslations('trade.wrapCleanup');
  const chain = getCurrentChain();
  const [pendingSig, setPendingSig] = useState<string | null>(null);

  useEffect(() => {
    const pending = readPendingWrap();
    if (!pending) return;
    setPendingSig(pending.setupSig);
    toast.warning(t('title'), {
      description: t('desc'),
      duration: 12_000,
      action: {
        label: t('viewTx'),
        onClick: () => {
          window.open(`${chain.explorer}/tx/${pending.setupSig}`, '_blank');
        },
      },
      cancel: {
        label: t('dismiss'),
        onClick: () => clearPendingWrap(),
      },
    });
  }, [t, chain.explorer]);

  // 隐藏 marker · 给 Playwright 验证 mount 检测到 pendingWrap
  if (!pendingSig) return null;
  return (
    <span
      data-testid="wrap-cleanup-detected"
      data-setup-sig={pendingSig}
      className="hidden"
      aria-hidden
    />
  );
}
