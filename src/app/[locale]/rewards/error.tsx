'use client';

import { PageError } from '@/components/error/page-error';

export default function RewardsError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      title="奖励中心加载失败"
      description="MEV / Reclaim 数据接口异常 · 重试通常能恢复 · 已记录的奖励不丢"
      error={error}
      reset={reset}
      logTag="rewards-page-error"
    />
  );
}
