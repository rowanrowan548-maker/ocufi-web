import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';

export async function SiteHeader() {
  const t = await getTranslations();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-lg">Ocufi</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {t('brand.tagline')}
          </span>
        </Link>
        <ConnectWalletButton variant="header" />
      </div>
    </header>
  );
}
