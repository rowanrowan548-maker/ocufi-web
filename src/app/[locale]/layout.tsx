import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PageTracker } from '@/components/analytics/page-tracker';
import { SolanaWalletProvider } from '@/components/providers/solana-wallet-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { SiteHeader } from '@/components/layout/site-header';
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

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ocufi.io'),
  title: {
    default: 'Ocufi · Solana Trading Terminal',
    template: '%s · Ocufi',
  },
  description:
    '非托管 · 低费 · 透明 · 开源的 Solana 链上交易终端。0.2% 手续费,免费安全审查,代码开源可审计。',
  keywords: [
    'Solana', 'DEX', '交易', 'meme', 'Jupiter', '非托管',
    'on-chain', 'crypto', 'wallet', 'open-source',
  ],
  applicationName: 'Ocufi',
  // T-800:Phantom 客服 Rory 回信 + docs.phantom.com 文档明确,
  // og:title / og:image / apple-touch-icon 是钱包风控抓取首选源。
  // 显式声明 absolute URL,绕开钱包爬虫对 dynamic route 的兼容性差异。
  openGraph: {
    type: 'website',
    siteName: 'Ocufi',
    title: 'Ocufi · Solana Trading Terminal',
    description:
      '非托管 · 0.2% 手续费 · 免费安全审查 · 代码开源。Solana 链上交易终端。',
    url: 'https://www.ocufi.io',
    locale: 'zh_CN',
    images: [
      {
        url: '/opengraph-image',
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
    description: 'Lower fees · Transparent pricing · No middleman tax. Solana on-chain.',
    images: ['/opengraph-image'],
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
          <SolanaWalletProvider>
            <SwRegister />
            <RefCapture />
            <WalletBind />
            <PageTracker />
            <SiteHeader />
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
