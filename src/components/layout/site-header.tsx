import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';

export async function SiteHeader() {
  const t = await getTranslations();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="text-lg">Ocufi</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link
              href="/trade"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('nav.trade')}
            </Link>
            <Link
              href="/portfolio"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('nav.portfolio')}
            </Link>
            <Link
              href="/token"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('nav.tokenCheck')}
            </Link>
          </nav>
        </div>
        <ConnectWalletButton variant="header" />
      </div>
    </header>
  );
}
