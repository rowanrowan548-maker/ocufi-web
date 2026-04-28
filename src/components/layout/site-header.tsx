import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { Logo } from '@/components/brand/logo';
import { NavDropdown } from './nav-dropdown';
import { SettingsMenu } from './settings-menu';
import { MobileNav } from './mobile-nav';
import { HeaderSearch } from './header-search';
import { StatusIndicator } from './status-indicator';
import { NAV_ENTRIES } from './nav-config';

/**
 * T-908a · OKX 风格 5 分组顶部 nav
 *
 *  [Logo]  交易  行情↓  策略↓  资产↓  更多↓        ⚙️  钱包
 */
export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <Logo variant="full" size={50} />
          </Link>
          {/* 桌面 nav · 5 entries */}
          <nav className="hidden lg:flex items-center gap-5 text-sm">
            {NAV_ENTRIES.map((e, i) =>
              e.type === 'link' ? (
                <Link
                  key={i}
                  href={e.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t(e.labelKey)}
                </Link>
              ) : (
                <NavDropdown key={i} group={e} />
              )
            )}
          </nav>
        </div>

        {/* 右侧:搜索 + 状态绿点 + 设置齿轮 + 钱包 + 移动汉堡 */}
        <div className="flex items-center gap-1.5">
          <HeaderSearch />
          {/* T-928 #18:服务状态小圆点常驻 lg+(连续监控)*/}
          <div className="hidden lg:block">
            <StatusIndicator />
          </div>
          <div className="hidden lg:block">
            <SettingsMenu />
          </div>
          <ConnectWalletButton variant="header" />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
