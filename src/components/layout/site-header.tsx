import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';

export async function SiteHeader() {
  const t = await getTranslations();
  const navLinks = [
    { href: '/trade', label: t('nav.trade') },
    { href: '/limit', label: t('nav.limit') },
    { href: '/portfolio', label: t('nav.portfolio') },
    { href: '/alerts', label: t('nav.alerts') },
    { href: '/history', label: t('nav.history') },
    { href: '/points', label: t('nav.points') },
    { href: '/token', label: t('nav.tokenCheck') },
    { href: '/faq', label: t('nav.faq') },
    { href: '/settings', label: t('nav.settings') },
  ];
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="text-lg">Ocufi</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <ConnectWalletButton variant="header" />
      </div>
      {/* 手机端 nav:单独一行,横向滚动避免挤爆 */}
      <nav className="sm:hidden flex items-center gap-5 text-xs overflow-x-auto px-4 pb-2 -mt-1">
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
