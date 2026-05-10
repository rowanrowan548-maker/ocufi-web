'use client';

import { PageError } from '@/components/error/page-error';

export default function HistoryError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      title="成交记录加载失败"
      description="可能是后端 / Helius 临时不通 · 重试或回首页"
      error={error}
      reset={reset}
      logTag="history-page-error"
    />
  );
}
