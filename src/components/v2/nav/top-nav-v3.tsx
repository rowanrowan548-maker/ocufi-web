'use client';

/**
 * V2 Top Nav · sticky 76px(桌面)/ 64px(mobile)
 * brand 顶部 1px gradient glow + Logo 36/32px + middle search + 4 主 link + nav-cta wallet
 *
 * 视觉 frozen 自 mockup `.coordination/V2/MOCKUPS/v2-overall.html` `.nav` 段
 *
 * P2-HOTFIX-2 #2 #4 #5:
 *   - 中间加 V1 HeaderSearch(桌面 inline trigger + mobile 🔍 图标 · / 和 ⌘K 全局快捷键)
 *   - 加第 4 tab "报告 (Demo)" → mock sig
 *   - mobile 砍抽屉 · 改 BottomTabBar(行业惯例)· 顶部 mobile 留 logo + 🔍 + wallet
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { LogoSvg } from '@/components/v2/shared/logo-svg';
import { HeaderSearch } from '@/components/layout/header-search';
import { useLastTxSig } from '@/lib/last-tx-sig';

// P2-HOTFIX-3 #2 · 代币 tab 不再硬指 SOL(SOL 没 LP 池 · K 线空白)· 改 BONK(真 demo)
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

type TabDef = { href: string; key: 'home' | 'token' | 'portfolio' | 'tx'; demoLabel?: string };

export function TopNavV3() {
  const t = useTranslations('v2.nav');
  const pathname = usePathname();
  // P3-FE-2 bug 2 · 报告 tab 跳真最近 sig · 没就回 portfolio(不再永远 demo)
  const lastSig = useLastTxSig();
  const TABS: TabDef[] = [
    { href: '/v2', key: 'home' },
    // P3-FE-4 polish 3 · 砍 demoLabel "示例 BONK" · 用户嫌多余 · 只留"代币"二字
    { href: `/v2/token/${BONK_MINT}`, key: 'token' },
    { href: '/v2/portfolio', key: 'portfolio' },
    lastSig
      ? { href: `/v2/tx/${lastSig}`, key: 'tx' }
      : { href: '/v2/portfolio', key: 'tx', demoLabel: 'Demo' },
  ];

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 76,
        padding: '0 56px',
        borderBottom: '1px solid var(--border-v2)',
        position: 'sticky',
        top: 0,
        background: 'rgba(11, 13, 18, 0.72)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        zIndex: 100,
      }}
      className="v2-top-nav"
    >
      {/* brand 顶部 1px gradient glow · 跟 OG 卡同语言 */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(25,251,155,0.4), transparent)',
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      />

      <Link
        href="/v2"
        prefetch={false}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'var(--font-geist), sans-serif',
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: '-0.025em',
          color: 'var(--ink-100)',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <LogoSvg size={36} />
        <span className="v2-nav-brand-text">OCUFI</span>
      </Link>

      {/* 中间 search · V1 HeaderSearch 桌面 inline + mobile 🔍 · / 和 ⌘K 全局快捷键
          pathBuilder 把搜索结果路由到 V2 token 详情而非 V1 /trade · 留 V2 闭环 */}
      <div className="v2-nav-search" style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        <HeaderSearch pathBuilder={(mint) => `/v2/token/${mint}`} />
      </div>

      {/* 桌面 4 主 link · mobile hide */}
      <div className="v2-nav-links" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {TABS.map((tab) => {
          const matchPrefix = tab.key === 'home' ? '/v2' : `/v2/${tab.key === 'tx' ? 'tx' : tab.key}`;
          const active =
            tab.key === 'home'
              ? pathname?.endsWith('/v2') || pathname === '/v2'
              : pathname?.includes(matchPrefix);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch={false}
              style={{
                color: active ? 'var(--ink-100)' : 'var(--ink-60)',
                fontSize: 14,
                padding: '8px 14px',
                cursor: 'pointer',
                transition: 'color 0.15s',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {t(tab.key)}
              {tab.demoLabel && (
                <span
                  style={{
                    marginLeft: 6,
                    fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                    fontSize: 10,
                    color: 'var(--ink-40)',
                    letterSpacing: '0.04em',
                  }}
                >
                  ({tab.demoLabel})
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div style={{ marginLeft: 12, flexShrink: 0 }}>
        <ConnectWalletButton />
      </div>
    </nav>
  );
}
