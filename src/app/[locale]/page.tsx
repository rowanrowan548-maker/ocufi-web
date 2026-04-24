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
      {/* ───── Hero ───── */}
      <section className="px-6 pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-6">
          <Badge variant="secondary" className="text-xs tracking-widest">
            {chain.name} · {t('landing.badge')}
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            {t('landing.hero.title')}
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
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

      {/* ───── 为什么 Ocufi ───── */}
      <section className="px-6 pb-16 sm:pb-20 border-t">
        <div className="max-w-5xl mx-auto pt-12 sm:pt-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
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
                className="rounded-lg border bg-card p-4 sm:p-5 flex flex-col gap-2"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm font-semibold mt-1">
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

      {/* ───── 你能做什么 ───── */}
      <section className="px-6 pb-16 sm:pb-20 border-t">
        <div className="max-w-5xl mx-auto pt-12 sm:pt-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
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
                className="group rounded-lg border bg-card p-4 flex items-center gap-3 hover:border-primary/40 hover:bg-card/80 transition"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {t(`landing.functions.${key}.title`)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t(`landing.functions.${key}.desc`)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="px-6 py-8 border-t mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-muted-foreground">
          <div className="font-mono">
            © {new Date().getFullYear()} Ocufi · {chain.name} · v0.3
          </div>
          <div className="flex gap-4">
            <a
              href="https://x.com/Ocufi_io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Twitter
            </a>
            <a
              href="https://github.com/rowanrowan548-maker/ocufi-web"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
