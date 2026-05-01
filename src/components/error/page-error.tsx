'use client';

/**
 * T-FE-STABILITY-ERROR-BOUNDARIES · 路由级 error boundary 共享渲染
 *
 * 6 个 route-level error.tsx 都是 Next 16 的 client component fallback ·
 * 几乎一样:接 { error, reset } props · render 一段中性提示 + 重试按钮 ·
 * 只在标题 / 描述上区分页面专属文案。
 *
 * 把 render 抽到这里 · 6 个 page error 文件每个只剩 2 行(import + 调用)·
 * 减少重复 · 统一视觉。
 *
 * 注意:Next 16 的 error boundary 必须是 client + default export · 不能 抽成 server
 *      component · 所以 route 文件本身也得是 use client + default export · 仅
 *      composition 抽出来。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Home, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** 页面专属标题(eg "交易页加载失败")*/
  title: string;
  /** 页面专属描述(eg "可能是行情接口波动 · 重试一下试试")*/
  description: string;
  /** Next 16 注入的 error 对象 */
  error: Error & { digest?: string };
  /** Next 16 注入的 reset · 让 Next 重渲染当前路由 */
  reset: () => void;
  /** 在 console.error 标签 · 默认 'page-error' */
  logTag?: string;
}

export function PageError({ title, description, error, reset, logTag = 'page-error' }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(`[${logTag}]`, error);
  }, [error, logTag]);

  const copyDiag = async () => {
    const ts = new Date().toISOString();
    const payload = [
      `Ocufi error · ${ts}`,
      `tag: ${logTag}`,
      error.digest ? `digest: ${error.digest}` : null,
      error.message ? `message: ${error.message}` : null,
      typeof window !== 'undefined' ? `path: ${window.location.pathname}` : null,
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 失败 · 静默
    }
  };

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center"
      data-testid="page-error"
      data-tag={logTag}
    >
      <div className="max-w-md w-full space-y-5">
        <div className="h-14 w-14 mx-auto rounded-full bg-[var(--brand-down)]/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-[var(--brand-down)]" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          {error.digest && (
            <p className="text-[10px] font-mono text-muted-foreground/50 pt-2">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button onClick={reset} className="w-full sm:w-auto" data-testid="page-error-retry">
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
        <div className="pt-1">
          <button
            type="button"
            onClick={copyDiag}
            data-testid="page-error-copy"
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
