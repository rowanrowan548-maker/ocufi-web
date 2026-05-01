'use client';

/**
 * T-PHANTOM-CONNECT-fe · Phantom Connect SDK Provider 包装
 *
 * 仅当 NEXT_PUBLIC_PHANTOM_APP_ID 已配置才挂 PhantomProvider · 否则直通 children
 * 避免本地 / 预发环境没配 App ID 时 SDK 报错
 *
 * T1.1 (2026-05-01) · 加 PhantomCleanupGuard 子组件:
 *   PhantomProvider mount 时 SDK 会自动跑 autoConnect · 若 IndexedDB 有 T1 修前
 *   遗留的"半成品 session"(有 keyPair · 无 access token)· stamp() 会抛
 *   "Auth2Stamper not initialized" · 错条经 connect_error event 走到 modal 顶部
 *   红条 · 即使用户没干啥也吓人。Guard 监听到这个特征错就主动 disconnect 清
 *   storage · 让下次 modal 干净打开。详见 SDK 源码:
 *   - @phantom/react-sdk/dist/index.mjs:851-863 (autoConnect on mount)
 *   - @phantom/react-sdk/dist/index.mjs:809-822 (connect_error → errors.connect)
 *   - @phantom/auth2/dist/index.mjs:329-335 (stamp() throws)
 */
import { useEffect } from 'react';
import { PhantomProvider, usePhantom } from '@phantom/react-sdk';
import {
  PHANTOM_PROVIDER_CONFIG,
  PHANTOM_APP_NAME,
  PHANTOM_APP_ICON,
  isPhantomConnectConfigured,
} from '@/lib/phantom-connect';

function PhantomCleanupGuard() {
  const { sdk, errors, clearError } = usePhantom();
  useEffect(() => {
    if (!sdk || !errors.connect) return;
    const msg = errors.connect.message ?? '';
    if (msg.includes('Auth2Stamper') || msg.includes('not initialized')) {
      console.warn('[PhantomConnect] stale stamper session · auto-cleaning');
      sdk.disconnect()
        .catch((e) => console.warn('[PhantomConnect] disconnect failed:', e))
        .finally(() => clearError('connect'));
    }
  }, [sdk, errors.connect, clearError]);
  return null;
}

export function PhantomConnectProvider({ children }: { children: React.ReactNode }) {
  if (!isPhantomConnectConfigured()) {
    return <>{children}</>;
  }
  return (
    <PhantomProvider
      // T1 fix:lib 现已用真 BrowserSDKConfig 类型 · 不再需要 any cast
      config={PHANTOM_PROVIDER_CONFIG}
      appName={PHANTOM_APP_NAME}
      appIcon={PHANTOM_APP_ICON}
    >
      <PhantomCleanupGuard />
      {children}
    </PhantomProvider>
  );
}
