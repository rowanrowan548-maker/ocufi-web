'use client';

/**
 * Locale-级 Error Boundary
 *
 * 任何 server / client 渲染异常被这里兜住。Next 16 自动注册成 fallback,
 * 在 layout 内捕获子树报错(layout 自己挂掉走 global-error.tsx)
 *
 * T-FE-STABILITY-ERROR-BOUNDARIES:加 trace_id 显示 + "复制错误信息"按钮
 *   - 复制内容 = digest + message + timestamp · 用户报 bug 时直接粘贴给我们
 *   - 不暴露 stack trace(SSR 环境敏感)
 *
 * 思路:展示中性错误页 + Reset 按钮(reset() 会让 Next 重新尝试渲染当前路由),
 *       避免任何敏感堆栈泄露给用户
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertOctagon, RefreshCw, Home, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 上报到 console(V2 接 Sentry / PostHog)
    console.error('[locale-error]', error);
  }, [error]);

  const copyDiag = async () => {
    const ts = new Date().toISOString();
    const payload = [
      `Ocufi error report · ${ts}`,
      error.digest ? `digest: ${error.digest}` : null,
      error.message ? `message: ${error.message}` : null,
      typeof window !== 'undefined' ? `path: ${window.location.pathname}` : null,
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 写失败(老浏览器/无 https)· 静默 · 用户能看到 ref 也行
    }
  };

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
        <div className="pt-2">
          <button
            type="button"
            onClick={copyDiag}
            data-testid="error-copy-diag"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground/80 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[var(--brand-up)]" />
                已复制 · 粘贴给客服
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                复制错误信息(给反馈用)
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
