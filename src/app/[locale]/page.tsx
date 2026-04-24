import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { Shield } from 'lucide-react';
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

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl flex flex-col items-center text-center gap-8">
        <Badge variant="secondary" className="text-xs tracking-widest">
          {t('landing.status')}
        </Badge>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight">
          {t('landing.hero.title')}
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
          {t('landing.hero.subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <ConnectWalletButton variant="landing" />
          <Button size="lg" variant="outline" disabled className="sm:min-w-[180px]">
            {t('landing.hero.cta_docs')}
          </Button>
        </div>

        <MobileDeeplink />

        {/* 免钱包功能:查币 */}
        <div className="w-full max-w-xl pt-4">
          <Link
            href="/token"
            className="group flex items-center gap-3 rounded-lg border border-border/60
                       bg-card/60 p-4 hover:border-primary/40 hover:bg-card transition"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">{t('landing.noWallet.title')}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t('landing.noWallet.hint')}
              </div>
            </div>
            <div className="text-xs text-muted-foreground group-hover:text-foreground">
              →
            </div>
          </Link>
        </div>

        <div className="pt-12 text-xs text-muted-foreground font-mono tracking-wider">
          {chain.name} · v0.2 · Day 2 · wallet connect
        </div>
      </div>
    </main>
  );
}
