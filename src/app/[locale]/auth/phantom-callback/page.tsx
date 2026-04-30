import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { PhantomCallbackScreen } from '@/components/auth/phantom-callback-screen';

/**
 * T-FE-PHANTOM-CALLBACK-PAGE · Phantom Connect SDK OAuth 回调落地页
 *
 * 背景:Rory 指出 phantom-connect.ts redirectUrl 指向 /auth/phantom-callback
 *      但 page 不存在 · OAuth 回跳 → 404 · 流程断
 *
 * 路由级 page · 实际 UI 在 client component(usePhantom 必须 client + Provider 内)
 *
 * SEO:不收录 · 这是过场页 · 1-3s 自动跳走
 */

export const metadata: Metadata = {
  title: 'Logging in · Ocufi',
  robots: { index: false, follow: false },
};

export default async function PhantomCallbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PhantomCallbackScreen />;
}
