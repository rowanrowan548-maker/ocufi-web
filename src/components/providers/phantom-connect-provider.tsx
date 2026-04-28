'use client';

/**
 * T-PHANTOM-CONNECT-fe · Phantom Connect SDK Provider 包装
 *
 * 仅当 NEXT_PUBLIC_PHANTOM_APP_ID 已配置才挂 PhantomProvider · 否则直通 children
 * 避免本地 / 预发环境没配 App ID 时 SDK 报错
 */
import { PhantomProvider } from '@phantom/react-sdk';
import {
  PHANTOM_PROVIDER_CONFIG,
  PHANTOM_APP_NAME,
  PHANTOM_APP_ICON,
  isPhantomConnectConfigured,
} from '@/lib/phantom-connect';

export function PhantomConnectProvider({ children }: { children: React.ReactNode }) {
  if (!isPhantomConnectConfigured()) {
    return <>{children}</>;
  }
  return (
    <PhantomProvider
      // SDK 类型 ProviderConfig 私有 · lib 已 cast 为 Record<string, any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config={PHANTOM_PROVIDER_CONFIG as any}
      appName={PHANTOM_APP_NAME}
      appIcon={PHANTOM_APP_ICON}
    >
      {children}
    </PhantomProvider>
  );
}
