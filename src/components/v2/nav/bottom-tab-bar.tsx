'use client';

/**
 * V2 Bottom Tab Bar · mobile only · sticky bottom 64px + 4 平分 tab + iOS safe-area
 *
 * 桌面 hide via .v2-bottom-tab-bar(globals.css 媒查 · 769+ 隐藏)
 * 行业惯例:Phantom / Twitter / Jupiter mobile 都 bottom tab · 散户找抽屉慢
 *
 * 4 tab(顺序跟桌面 nav 对齐):首页 / 代币(SOL 默认) / 持仓 / 报告(Demo · mock sig)
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Coins, Wallet, FileText } from 'lucide-react';

// P2-HOTFIX-3 #2 · 代币 tab 改 BONK 真示例(SOL 没 LP)
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

export function BottomTabBar() {
  const t = useTranslations('v2.nav');
  const pathname = usePathname() ?? '';

  const TABS = [
    { href: '/', key: 'home' as const, icon: Home, match: (p: string) => p === '/' || /^\/[a-z-]+\/?$/.test(p) },
    { href: `/token/${BONK_MINT}`, key: 'token' as const, icon: Coins, match: (p: string) => p.includes('/token') },
    { href: '/portfolio', key: 'portfolio' as const, icon: Wallet, match: (p: string) => p.includes('/portfolio') },
    // P3-FE-7 · "报告" tab 跳列表页 · 不再单 sig
    { href: '/reports', key: 'tx' as const, icon: FileText, match: (p: string) => p.includes('/tx') || p.includes('/reports') },
  ];

  return (
    <nav
      className="v2-bottom-tab-bar"
      style={{
        display: 'none', // 桌面 hide · mobile 媒查打开
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: 'rgba(11, 13, 18, 0.92)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid var(--border-v2)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 90,
      }}
    >
      <div style={{ display: 'flex', height: 64, alignItems: 'stretch' }}>
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch={false}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                color: active ? 'var(--brand-up)' : 'var(--ink-60)',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.02em',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {t(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
