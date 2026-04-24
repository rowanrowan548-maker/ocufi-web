import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { SolanaWalletProvider } from '@/components/providers/solana-wallet-provider';
import { SiteHeader } from '@/components/layout/site-header';
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
  title: 'Ocufi · Solana 交易终端',
  description: '非托管 · 低手续费 · 透明 · 开源的 Solana 链上交易终端',
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SolanaWalletProvider>
            <SiteHeader />
            {children}
          </SolanaWalletProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
