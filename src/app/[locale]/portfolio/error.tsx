'use client';

import { PageError } from '@/components/error/page-error';

export default function PortfolioError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      title="持仓页加载失败"
      description="价格 / 余额接口暂时不可用 · 重试通常能恢复"
      error={error}
      reset={reset}
      logTag="portfolio-page-error"
    />
  );
}
