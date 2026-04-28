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
  // T-963 · 中文 locale 显"天眼"小字 · en-US 返空字符串 → 不渲染
  const brandTagline = t('nav.brandTagline');

  // T-940 R1:iOS Safari 安全区(notch / 动态岛 / URL bar)— 防止 sticky 顶部 nav 被遮
  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* T-986 · 桌面 lg+ 解 max-w-7xl(配合 T-984a 全屏)· nav gap 拉开 · 搜索吃中间 */}
      <div className="mx-auto flex h-11 sm:h-20 max-w-7xl lg:max-w-none lg:mx-0 items-center justify-between gap-3 lg:gap-6 px-3 sm:px-4">
        <div className="flex items-center gap-3 sm:gap-6 lg:gap-8 min-w-0 flex-shrink-0">
          <Link href="/" className="flex items-center gap-1.5 flex-shrink-0" aria-label="Ocufi">
            {/* T-977c · mobile 32 / sm+ 50(网格密度上升,移动 header 总高 64→44px) */}
            <span className="sm:hidden">
              <Logo variant="full" size={32} />
            </span>
            <span className="hidden sm:inline-flex">
              <Logo variant="full" size={50} />
            </span>
            {/* T-973-fix · 回滚到附属字 + 颜色提亮一档(text-foreground/65) */}
            {brandTagline && (
              <span
                className="hidden sm:inline-block text-[12px] tracking-[0.15em] text-foreground/65 border-l border-border/60 pl-1.5 leading-tight"
                aria-hidden="true"
              >
                {brandTagline}
              </span>
            )}
          </Link>
          {/* 桌面 nav · 5 entries · T-986 gap-5 → gap-6 xl:gap-8 */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm">
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

        {/* T-986 · 桌面搜索吃中间 flex-1 · 移动 search 图标在右侧 cluster 里(HeaderSearch 自动适应) */}
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <HeaderSearch />
        </div>

        {/* 右侧:搜索(移动) + 状态绿点 + 设置齿轮 + 钱包 + 移动汉堡 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 移动 search · 桌面已在中间 cluster 渲染过,这里也走 HeaderSearch 但桌面分支 hidden lg:hidden 防双显 */}
          <div className="lg:hidden">
            <HeaderSearch />
          </div>
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
