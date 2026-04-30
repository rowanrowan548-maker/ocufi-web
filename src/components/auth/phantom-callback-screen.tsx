'use client';

/**
 * T-FE-PHANTOM-CALLBACK-PAGE · Phantom Connect 回调过场页
 *
 * 行为:
 *   1. mount 即开始监听 usePhantom() 的 isConnected / errors / isConnecting
 *   2. SDK 自动从 URL 解析 OAuth 参数(SDK 在 PhantomProvider mount 时处理)
 *   3. isConnected → router.replace('/trade')(去主交易页)
 *   4. errors.connect → 显示错误 + 两按钮(重试 / 回首页)
 *   5. 兜底 timeout 8s · 还在 isConnecting 又没 connect 也没 error → 当 error 处理
 *
 * SDK 没暴露公开的"handleRedirect()" · v2.0.2 是把 redirect 处理放在 Provider
 * 初始化里 · 我们这边只观察 usePhantom() state 等 SDK 自己消化完。
 *
 * 不调 SDK 公开 hook 时该页仍能渲染 · 也兜底了 PhantomProvider 没挂(env 缺)
 * 的情况:isPhantomConnectConfigured=false → 直接进 error 态 + 提示。
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { usePhantom } from '@phantom/react-sdk';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isPhantomConnectConfigured } from '@/lib/phantom-connect';

const TIMEOUT_MS = 8_000;

export function PhantomCallbackScreen() {
  if (!isPhantomConnectConfigured()) {
    // env 缺 · PhantomProvider 没挂 · 调 usePhantom() 会抛 · 改走静态 error
    return <CallbackError reason="not-configured" />;
  }
  return <CallbackInner />;
}

function CallbackInner() {
  const t = useTranslations('auth.callback');
  const router = useRouter();
  const phantom = usePhantom();
  const [timedOut, setTimedOut] = useState(false);
  // 只跳一次 · 防 SDK 重复触发 isConnected
  const navigatedRef = useRef(false);

  // 8s 兜底 timeout
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  // 监听连接成功 → 跳 /trade
  useEffect(() => {
    if (navigatedRef.current) return;
    if (phantom.isConnected && phantom.addresses && phantom.addresses.length > 0) {
      navigatedRef.current = true;
      router.replace('/trade');
    }
  }, [phantom.isConnected, phantom.addresses, router]);

  const err = phantom.errors?.connect;
  const errorish = !!err || (timedOut && !phantom.isConnected);

  if (errorish) {
    return (
      <CallbackError
        reason={err ? 'sdk-error' : 'timeout'}
        message={err?.message}
        onRetry={() => router.replace('/')}
        onHome={() => router.replace('/')}
        retryLabel={t('retry')}
        homeLabel={t('home')}
        title={t('error')}
      />
    );
  }

  // 默认 loading 态 · 包括 isConnecting / isLoading / 等待 SDK 处理 redirect
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8 text-center space-y-4" data-testid="phantom-callback-loading">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-[var(--brand-up)]" />
        <div className="text-base font-medium">{t('loading')}</div>
        <div className="text-xs text-muted-foreground">{t('loadingHint')}</div>
      </Card>
    </main>
  );
}

interface ErrorProps {
  reason: 'not-configured' | 'sdk-error' | 'timeout';
  message?: string;
  onRetry?: () => void;
  onHome?: () => void;
  retryLabel?: string;
  homeLabel?: string;
  title?: string;
}

function CallbackError({
  reason, message, onRetry, onHome, retryLabel, homeLabel, title,
}: ErrorProps) {
  // 不在 Provider context 时也得能 render(usePhantom 失败时走这条) · 不调 useTranslations
  // 用 fallback zh 文案 · 跟 /admin 全 hardcoded zh 一致(过场页说英文走 i18n 即可 · zh 兜底)
  const finalTitle = title ?? '登录失败';
  const finalRetry = retryLabel ?? '重试';
  const finalHome = homeLabel ?? '回首页';
  const reasonText =
    reason === 'not-configured'
      ? 'Phantom Connect 未配置(NEXT_PUBLIC_PHANTOM_APP_ID 缺失)'
      : reason === 'timeout'
        ? '8 秒内 SDK 未完成回调处理 · 可能是网络或 OAuth 链路问题'
        : message || '未知错误';

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card
        className="w-full max-w-md p-8 text-center space-y-4"
        data-testid="phantom-callback-error"
        data-reason={reason}
      >
        <AlertCircle className="h-10 w-10 mx-auto text-[var(--brand-down)]" />
        <div className="text-base font-semibold">{finalTitle}</div>
        <div className="text-xs text-muted-foreground break-all font-mono">{reasonText}</div>
        <div className="flex items-center gap-2 justify-center pt-2">
          <Button
            variant="outline"
            onClick={onHome ?? (() => { window.location.href = '/'; })}
            data-testid="phantom-callback-home"
          >
            {finalHome}
          </Button>
          <Button
            onClick={onRetry ?? (() => { window.location.href = '/'; })}
            data-testid="phantom-callback-retry"
            className="bg-[var(--brand-up)] hover:bg-[var(--brand-up)]/90 text-black"
          >
            {finalRetry}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Card>
    </main>
  );
}
