import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import {
  Shield, Lock, Coins, Eye, ArrowRight,
  LineChart, Timer, Wallet, Bell, History, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCurrentChain } from '@/config/chains';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { MobileDeeplink } from '@/components/wallet/mobile-deeplink';
import { MarketSnapshot } from '@/components/landing/market-snapshot';
import { TokenList } from '@/components/landing/token-list';
import { PriceTicker } from '@/components/landing/price-ticker';

export default async function Landing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const chain = getCurrentChain();

  const features = [
    { Icon: Lock, key: 'nonCustodial' },
    { Icon: Coins, key: 'lowFee' },
    { Icon: ShieldCheck, key: 'safety' },
    { Icon: Eye, key: 'openSource' },
  ] as const;

  const funcs = [
    { href: '/trade', Icon: LineChart, key: 'trade' },
    { href: '/limit', Icon: Timer, key: 'limit' },
    { href: '/portfolio', Icon: Wallet, key: 'portfolio' },
    { href: '/alerts', Icon: Bell, key: 'alerts' },
    { href: '/history', Icon: History, key: 'history' },
    { href: '/token', Icon: Shield, key: 'tokenCheck' },
  ] as const;

  return (
    <main className="flex flex-1 flex-col">
      {/* ═══════ Price Ticker ═══════ */}
      <PriceTicker />

      {/* ═══════ Hero ═══════ */}
      <section className="relative px-4 sm:px-6 pt-10 sm:pt-16 pb-6 sm:pb-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 50% 0%, oklch(0.88 0.25 155 / 12%), transparent 70%)',
          }}
        />

        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-5">
          <Badge
            variant="secondary"
            className="text-xs tracking-widest bg-primary/10 border border-primary/20 text-primary"
          >
            {chain.name} · {t('landing.badge')}
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] font-heading">
            {t('landing.hero.title')}
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-1">
            <ConnectWalletButton variant="landing" />
            <Link href="/token" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:min-w-[180px]">
                <Shield className="mr-2 h-4 w-4" />
                {t('landing.hero.cta_check')}
              </Button>
            </Link>
          </div>

          <MobileDeeplink />
        </div>
      </section>

      {/* ═══════ Market Snapshot ═══════ */}
      <MarketSnapshot />

      {/* ═══════ Token List · 币安风行情主表 ═══════ */}
      <TokenList />

      {/* ═══════ Features ═══════ */}
      <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
              {t('landing.features.title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('landing.features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {features.map(({ Icon, key }) => (
              <div
                key={key}
                className="group relative rounded-xl border border-border/60 bg-card p-4 sm:p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm font-semibold">
                  {t(`landing.features.${key}.title`)}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {t(`landing.features.${key}.desc`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 能做什么 ═══════ */}
      <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
              {t('landing.functions.title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('landing.functions.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {funcs.map(({ href, Icon, key }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:border-primary/40 hover:bg-card/70 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {t(`landing.functions.${key}.title`)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t(`landing.functions.${key}.desc`)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ Footer ═══════ */}
      <footer className="px-4 sm:px-6 py-8 border-t border-border/40 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-muted-foreground">
          <div className="font-mono">
            © {new Date().getFullYear()} Ocufi · {chain.name} · v0.4
          </div>
          <div className="flex gap-4 flex-wrap">
            <a
              href="https://x.com/Ocufi_io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              𝕏 Twitter
            </a>
            <a
              href="https://github.com/rowanrowan548-maker/ocufi-web"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
            <Link href="/faq" className="hover:text-foreground">FAQ</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">{t('legal.footer.privacy')}</Link>
            <Link href="/legal/terms" className="hover:text-foreground">{t('legal.footer.terms')}</Link>
            <Link href="/legal/disclaimer" className="hover:text-foreground">{t('legal.footer.disclaimer')}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
