'use client';

/**
 * T-965 #166 · 通用错误边界
 * 包 form / list 子树,出现 React render 错误时显友好兜底卡 + 重置按钮
 *
 * 用法:
 *   <ErrorBoundary fallback="trade.errors.formCrashed">
 *     <BuyForm />
 *   </ErrorBoundary>
 */
import { Component, type ReactNode } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** i18n key 或纯文本兜底 · default 通用 */
  fallbackTitle?: string;
  fallbackBody?: string;
  /** Sentry / analytics 钩子 · 默认 console.warn */
  onError?: (error: Error) => void;
}

interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError) this.props.onError(error);
    else console.warn('[ErrorBoundary]', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3 text-sm">
        <div className="flex items-start gap-2 text-destructive font-medium">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{this.props.fallbackTitle ?? '页面组件出错了 · Component crashed'}</span>
        </div>
        <div className="text-xs text-muted-foreground break-all">
          {this.props.fallbackBody ?? this.state.error.message}
        </div>
        <Button size="sm" variant="outline" onClick={this.reset} className="h-7 text-xs">
          <RotateCw className="h-3 w-3 mr-1" />
          重试 / Retry
        </Button>
      </div>
    );
  }
}
