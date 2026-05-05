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
import { MOCK_TX_SIG } from '@/components/v2/shared/mock-sig';

// P2-HOTFIX-3 #2 · 代币 tab 改 BONK 真示例(SOL 没 LP)
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

const TABS = [
  { href: '/v2', key: 'home' as const, icon: Home, match: (p: string) => p === '/v2' || /^\/[a-z-]+\/v2$/.test(p) },
  { href: `/v2/token/${BONK_MINT}`, key: 'token' as const, icon: Coins, match: (p: string) => p.includes('/v2/token') },
  { href: '/v2/portfolio', key: 'portfolio' as const, icon: Wallet, match: (p: string) => p.includes('/v2/portfolio') },
  { href: `/v2/tx/${MOCK_TX_SIG}`, key: 'tx' as const, icon: FileText, match: (p: string) => p.includes('/v2/tx') },
];

export function BottomTabBar() {
  const t = useTranslations('v2.nav');
  const pathname = usePathname() ?? '';

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
