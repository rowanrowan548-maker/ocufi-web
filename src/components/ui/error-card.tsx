'use client';

/**
 * T-FE-STABILITY-ERROR-BOUNDARIES · 行内错误降级卡片
 *
 * 用途:某段数据 fetch 失败时 · 卡片本身降级显示 ErrorCard 而不是把异常往上抛炸整页
 *
 * 跟 PageError 的区别:
 *   - PageError 是路由级 fallback(Next 16 error.tsx 整页接管)
 *   - ErrorCard 是组件内部的局部降级(只这一卡红色 · 其它卡照常用)
 *
 * 用法示例:
 *   const { data, error } = useFoo();
 *   if (error) return <ErrorCard title="行情加载失败" message={error.message} onRetry={refetch} />;
 *   if (!data) return <Skeleton className="h-20" />;
 *   return <ActualCard data={data} />;
 */
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from './card';
import { Button } from './button';

interface Props {
  /** 卡片标题 · 简短(eg "行情加载失败")*/
  title: string;
  /** 详细描述 · 可选 · 给用户看 · 不必技术 */
  message?: string;
  /** 原始错误 message · 折在 <details> 里 · 给报 bug 用 */
  detail?: string;
  /** 点 "重试" 时调用 · 没传则不显示重试按钮 */
  onRetry?: () => void;
  /** 给 className · 控制最小高度 / padding */
  className?: string;
  /** 给 e2e 用 · 默认 'error-card' */
  testId?: string;
}

export function ErrorCard({
  title, message, detail, onRetry, className, testId = 'error-card',
}: Props) {
  return (
    <Card
      className={className ?? 'p-4'}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-[var(--brand-down)] flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-medium">{title}</div>
          {message && (
            <p className="text-xs text-muted-foreground">{message}</p>
          )}
          {detail && (
            <details className="text-[10px] text-muted-foreground/60 font-mono pt-1">
              <summary className="cursor-pointer hover:text-foreground/70">详情</summary>
              <pre className="mt-1 break-all whitespace-pre-wrap">{detail}</pre>
            </details>
          )}
        </div>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="flex-shrink-0"
            data-testid={`${testId}-retry`}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            重试
          </Button>
        )}
      </div>
    </Card>
  );
}
