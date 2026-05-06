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
// T-UI-OVERHAUL Stage 5.4 · 用 TopNavV2(luxury 3 主 tab + ⋯ MoreMenu)替代旧 SiteHeader
// 旧 SiteHeader 文件保留(精简战略"砍 UI 不砍代码")· 不引用就不渲染
import { TopNavV2 } from '@/components/layout-v2/top-nav-v2';
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

// T-UI-OVERHAUL v2 · luxury dark glass · 范围:首页 / 持仓 / 奖励
// v1 字体(Space_Grotesk/Inter/JetBrains_Mono)保留 · 老页面继续用 · 不动
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
  // P5-FE-13 · 不显式写 images · Next 自动从 src/app/opengraph-image.tsx 注入 og:image
  // + hash query(每次文件改 hash 变 · X/TG 爬虫强制重抓 · 治根 X 卡缓存老中文 V1 图)
  // alt / size / contentType 由 opengraph-image.tsx 自身 export 提供
  openGraph: {
    type: 'website',
    siteName: 'Ocufi',
    title: 'Ocufi · Solana Trading Terminal',
    description:
      'Lower fees · Transparent pricing · MEV protected · Permanent shareable transparency report. Solana on-chain.',
    url: 'https://www.ocufi.io',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@Ocufi_io',
    creator: '@Ocufi_io',
    title: 'Ocufi · Solana Trading Terminal',
    description:
      'Lower fees · Transparent pricing · MEV protected · Permanent shareable transparency report. Solana on-chain.',
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
            <TopNavV2 />
            {children}
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
