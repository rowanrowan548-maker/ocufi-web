'use client';

import { PageError } from '@/components/error/page-error';

export default function MarketsError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      title="行情页加载失败"
      description="GeckoTerminal 数据源临时波动 · 重试或回首页"
      error={error}
      reset={reset}
      logTag="markets-page-error"
    />
  );
}
