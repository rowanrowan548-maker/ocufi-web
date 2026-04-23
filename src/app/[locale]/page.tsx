import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCurrentChain } from '@/config/chains';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';

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

        <div className="pt-12 text-xs text-muted-foreground font-mono tracking-wider">
          {chain.name} · v0.2 · Day 2 · wallet connect
        </div>
      </div>
    </main>
  );
}
