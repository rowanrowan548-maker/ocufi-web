'use client';

/**
 * T-PHANTOM-CONNECT-fe · Phantom Connect SDK Provider 包装(延迟 mount 版)
 *
 * 仅当 NEXT_PUBLIC_PHANTOM_APP_ID 已配置才挂 PhantomProvider · 否则直通 children
 *
 * T1.5 (2026-05-01) · 延迟 mount:
 *   PhantomProvider mount 时 SDK 会**强制**自动跑 sdk.autoConnect()
 *   (@phantom/react-sdk/dist/index.mjs:851-863)· SDK 没暴露 disable autoConnect prop
 *   (T1.1 读完 PhantomProviderProps 类型确认 · 只接收 children/config/debugConfig/
 *   theme/appIcon/appName 6 个 prop)。
 *
 *   即使 IndexedDB 干净 · autoConnect 仍会 emit `connect_error` 走到 modal 红条 ·
 *   PhantomCleanupGuard 异步清慢半拍 · 用户已经看到红条。T1.4 prewipe 实测无效
 *   (用户清完 site data 仍报错 · 证明根因不在数据残留 · 在 SDK 行为本身)。
 *
 *   治本:Provider 默认不挂 · 用户点 PhantomConnectButton 才触发挂载 + 立刻开 modal。
 *   OAuth 回跳到 /auth/phantom-callback 时立即挂(让 SDK 处理 redirect resume)。
 *
 * T1.1 PhantomCleanupGuard 仍保留作为兜底防御(防 OAuth 中途被 SDK 升级出新 stale)
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PhantomProvider, usePhantom } from '@phantom/react-sdk';
import {
  PHANTOM_PROVIDER_CONFIG,
  PHANTOM_APP_NAME,
  PHANTOM_APP_ICON,
  isPhantomConnectConfigured,
} from '@/lib/phantom-connect';

interface PhantomMountValue {
  /** PhantomProvider 是否已挂载(true → SDK 已 init · 可调 useModal 等 hook) */
  isMounted: boolean;
  /** 用户刚 requestMount · 等 mount 完后 inner button 应立即调 modal.open() */
  pendingOpen: boolean;
  /** button 点击 · 触发 mount + 标记 pendingOpen */
  requestMount: () => void;
  /** inner button 消费 pendingOpen · 防重复 open */
  consumePendingOpen: () => void;
}

const PhantomMountContext = createContext<PhantomMountValue>({
  isMounted: false,
  pendingOpen: false,
  requestMount: () => {},
  consumePendingOpen: () => {},
});

export function usePhantomMount(): PhantomMountValue {
  return useContext(PhantomMountContext);
}

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

function DeferredPhantomMount({ children }: { children: React.ReactNode }) {
  // OAuth 回跳页 · 同步标记需挂载(usePathname 在 SSR/CSR 都返当前 pathname ·
  // 不走 useEffect 避免 SSR 渲染 callback screen 时 usePhantom 抛 not-in-context)
  const pathname = usePathname();
  const isCallbackRoute = pathname?.includes('/auth/phantom-callback') ?? false;

  const [requestedMount, setRequestedMount] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const isMounted = isCallbackRoute || requestedMount;

  const value = useMemo<PhantomMountValue>(() => ({
    isMounted,
    pendingOpen,
    requestMount: () => {
      setPendingOpen(true);
      setRequestedMount(true);
    },
    consumePendingOpen: () => setPendingOpen(false),
  }), [isMounted, pendingOpen]);

  if (!isMounted) {
    return (
      <PhantomMountContext.Provider value={value}>
        {children}
      </PhantomMountContext.Provider>
    );
  }

  return (
    <PhantomMountContext.Provider value={value}>
      <PhantomProvider
        config={PHANTOM_PROVIDER_CONFIG}
        appName={PHANTOM_APP_NAME}
        appIcon={PHANTOM_APP_ICON}
      >
        <PhantomCleanupGuard />
        {children}
      </PhantomProvider>
    </PhantomMountContext.Provider>
  );
}

export function PhantomConnectProvider({ children }: { children: React.ReactNode }) {
  if (!isPhantomConnectConfigured()) {
    return <>{children}</>;
  }
  return <DeferredPhantomMount>{children}</DeferredPhantomMount>;
}
