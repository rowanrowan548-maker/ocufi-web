'use client';

import { PageError } from '@/components/error/page-error';

export default function AdminError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      title="后台加载失败"
      description="ADMIN_KEY 错 / 后端不可用 / 某段聚合 endpoint 报错都可能 · 重试或换 key"
      error={error}
      reset={reset}
      logTag="admin-page-error"
    />
  );
}
