'use client';

import { PageError } from '@/components/error/page-error';

export default function TradeError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      title="交易页加载失败"
      description="可能是行情接口波动 · 钱包接入异常 · 重试一下试试"
      error={error}
      reset={reset}
      logTag="trade-page-error"
    />
  );
}
