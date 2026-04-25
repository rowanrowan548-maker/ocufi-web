'use client';

/**
 * Locale-级 Error Boundary
 *
 * 任何 server / client 渲染异常被这里兜住。Next 16 自动注册成 fallback,
 * 在 layout 内捕获子树报错(layout 自己挂掉走 global-error.tsx)
 *
 * 思路:展示中性错误页 + Reset 按钮(reset() 会让 Next 重新尝试渲染当前路由),
 *       避免任何敏感堆栈泄露给用户
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 上报到 console(V2 接 Sentry / PostHog)
    console.error('[locale-error]', error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full space-y-5">
        <div className="h-16 w-16 mx-auto rounded-full bg-danger/10 flex items-center justify-center">
          <AlertOctagon className="h-8 w-8 text-danger" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">页面出错了</h1>
          <p className="text-sm text-muted-foreground">
            刚才那一步跑出问题了,可以重试或者回首页继续。
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-muted-foreground/50 pt-2">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button onClick={reset} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">
              <Home className="h-4 w-4 mr-2" />
              回首页
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
