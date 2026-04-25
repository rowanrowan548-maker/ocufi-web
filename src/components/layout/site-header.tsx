import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { Logo } from '@/components/brand/logo';
import { MoreMenu } from './more-menu';

export async function SiteHeader() {
  const t = await getTranslations();

  // 主 nav · 一线功能,限价单已整合进交易页
  const mainLinks = [
    { href: '/trade', label: t('nav.trade') },
    { href: '/watchlist', label: t('nav.watchlist') },
    { href: '/portfolio', label: t('nav.portfolio') },
    { href: '/token', label: t('nav.tokenCheck') },
  ];

  // 二线功能 · 收到"更多"下拉
  const moreLinks = [
    { href: '/alerts', label: t('nav.alerts') },
    { href: '/history', label: t('nav.history') },
    { href: '/points', label: t('nav.points') },
    { href: '/faq', label: t('nav.faq') },
    { href: '/settings', label: t('nav.settings') },
  ];

  // 手机端 nav 全部展开(横向滚动)
  const allLinks = [...mainLinks, ...moreLinks];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="full" size={22} />
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-sm">
            {mainLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <MoreMenu label={t('nav.more')} items={moreLinks} />
          </nav>
        </div>
        <ConnectWalletButton variant="header" />
      </div>
      {/* 手机端 nav · 横向滚动一行 */}
      <nav className="sm:hidden flex items-center gap-5 text-xs overflow-x-auto px-4 pb-2 -mt-1">
        {allLinks.map((l) => (
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
