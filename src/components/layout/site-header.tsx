import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { Logo } from '@/components/brand/logo';
import { MoreMenu } from './more-menu';
import { MobileNav } from './mobile-nav';

export async function SiteHeader() {
  const t = await getTranslations();

  // 主 nav · 一线功能,限价单已整合进交易页
  const mainLinks = [
    { href: '/trade', label: t('nav.trade') },
    { href: '/watchlist', label: t('nav.watchlist') },
    { href: '/portfolio', label: t('nav.portfolio') },
    { href: '/token', label: t('nav.tokenCheck') },
  ];

  // 二线功能 · 桌面收到「更多」下拉,移动端进抽屉
  const moreLinks = [
    { href: '/invite', label: t('nav.invite') },
    { href: '/alerts', label: t('nav.alerts') },
    { href: '/history', label: t('nav.history') },
    { href: '/points', label: t('nav.points') },
    { href: '/docs', label: t('nav.docs') },
    { href: '/faq', label: t('nav.faq') },
    { href: '/status', label: t('nav.status') },
    { href: '/settings', label: t('nav.settings') },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 sm:h-20 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="full" size={50} />
          </Link>
          {/* 桌面 nav */}
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

        {/* 右侧:钱包 + 移动端汉堡 */}
        <div className="flex items-center gap-1">
          <ConnectWalletButton variant="header" />
          <MobileNav
            mainLinks={mainLinks}
            moreLinks={moreLinks}
            moreLabel={t('nav.more')}
          />
        </div>
      </div>
    </header>
  );
}
