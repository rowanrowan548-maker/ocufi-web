import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Space_Grotesk, Inter, JetBrains_Mono, Geist, Geist_Mono, Newsreader } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PageTracker } from '@/components/analytics/page-tracker';
import { SolanaWalletProvider } from '@/components/providers/solana-wallet-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
// P5-FE-25 · V2 全面上位 · TopNavV3 替 TopNavV2 · v2-shell 嵌入 root layout
import { TopNavV3 } from '@/components/v2/nav/top-nav-v3';
import { BottomTabBar } from '@/components/v2/nav/bottom-tab-bar';
import { ScrollHint } from '@/components/v2/shared/scroll-hint';
import { FooterV2 } from '@/components/v2/shared/footer-v2';
import { FeedbackButton } from '@/components/feedback/feedback-button';
import { SwRegister } from '@/components/pwa/sw-register';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { MobileDeeplink } from '@/components/wallet/mobile-deeplink';
import { RefCapture } from '@/components/invite/ref-capture';
import { WalletBind } from '@/components/invite/wallet-bind';
import { Toaster } from '@/components/ui/sonner';
import '../globals.css';

// 品牌字体 · heading / hero
const spaceGrotesk = Space_Grotesk({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
});
// 正文 · 按钮 / 卡片
const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});
// 数字 / 合约地址 / 价格
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

// V2 luxury dark glass · 范围:全站(P5-FE-25 V2 全面上位)
const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  display: 'swap',
});
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});
// Newsreader · 关键数字 / accent · 必带 italic
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ocufi.io'),
  title: {
    default: 'Ocufi · Solana Trading Terminal',
    template: '%s · Ocufi',
  },
  // P4-FE-9 · V2 软发布后 root OG 升级英文为主 · 突出卖点 · 透明度报告 + 防夹 + 永久 URL
  description:
    'Solana trading terminal · 0.1% fee (10x cheaper than 1% industry) · MEV protected · Permanent transparency report URL.',
  keywords: [
    'Solana', 'DEX', 'meme', 'Jupiter', 'non-custodial',
    'on-chain', 'crypto', 'wallet', 'open-source', 'MEV protected', 'transparency',
  ],
  applicationName: 'Ocufi',
  // P5-FE-15 改 1 · 显式写回 og:image · 加 ?v= 版本号 query
  // P5-FE-13 删 images 期望 Next 自动注入 · 但 [locale] segment 不传播根 opengraph-image.tsx
  // → root html 0 条 og:image meta(curl 实证比改前更糟)· 改回显式写 · 用版本号 query 治 X 缓存
  // 守则:OG 视觉大改时 · v=YYYYMMDD 递增(对齐当前 OG 图最后修改日 2026-05-06 P4-FE-9 V2 化)
  openGraph: {
    type: 'website',
    siteName: 'Ocufi',
    title: 'Ocufi · Solana Trading Terminal',
    description:
      'Lower fees · Transparent pricing · MEV protected · Permanent shareable transparency report. Solana on-chain.',
    url: 'https://www.ocufi.io',
    locale: 'zh_CN',
    images: [
      {
        url: '/opengraph-image?v=20260506',
        width: 1200,
        height: 630,
        alt: 'Ocufi · Solana Trading Terminal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@Ocufi_io',
    creator: '@Ocufi_io',
    title: 'Ocufi · Solana Trading Terminal',
    description:
      'Lower fees · Transparent pricing · MEV protected · Permanent shareable transparency report. Solana on-chain.',
    images: ['/opengraph-image?v=20260506'],
  },
  icons: {
    icon: '/icon.svg',
    apple: [
      { url: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: '#19FB9B',
  colorScheme: 'dark',
  // P4-FE-5 · 双保险锁系统字号倍率到 1.0 · Android 厂商 webview(MIUI/ColorOS/OneUI · TG 内置)
  // 默认放大 1.15-1.3x → 散落卡爆宽 / chip 单列 · 配合 globals.css text-size-adjust: 100% 治根
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${geist.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
          <SolanaWalletProvider>
            <SwRegister />
            <RefCapture />
            <WalletBind />
            <PageTracker />
            <div className="v2-shell">
              <TopNavV3 />
              <ScrollHint />
              <div className="v2-shell-children">{children}</div>
              <FooterV2 />
              <BottomTabBar />
            </div>
            <FeedbackButton />
            <InstallPrompt />
            <MobileDeeplink />
            <Toaster />
          </SolanaWalletProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
