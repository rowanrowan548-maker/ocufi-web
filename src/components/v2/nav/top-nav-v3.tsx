'use client';

/**
 * V2 Top Nav · sticky 76px(桌面)/ 64px(mobile)
 * brand 顶部 1px gradient glow + Logo 36/32px + 3 主 link + nav-cta wallet
 *
 * 视觉 frozen 自 mockup `.coordination/V2/MOCKUPS/v2-overall.html` `.nav` 段
 *
 * mobile 不挂 MoreMenu(V2 极简战略 · 直接 3 主 link 全显)
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { LogoSvg } from '@/components/v2/shared/logo-svg';

const TABS: { href: string; key: 'home' | 'token' | 'portfolio' }[] = [
  { href: '/v2', key: 'home' },
  { href: '/v2/token/So11111111111111111111111111111111111111112', key: 'token' }, // SOL 默认
  { href: '/v2/portfolio', key: 'portfolio' },
];

export function TopNavV3() {
  const t = useTranslations('v2.nav');
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
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
        }}
      >
        <LogoSvg size={36} />
        <span>OCUFI</span>
      </Link>

      <div style={{ flex: 1 }} />

      {/* 桌面 3 主 link · mobile hide */}
      <div className="v2-nav-links" style={{ display: 'flex', gap: 4 }}>
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href.split('/').slice(0, 3).join('/'));
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
              }}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </div>

      <div style={{ marginLeft: 12 }}>
        <ConnectWalletButton />
      </div>
    </nav>
  );
}
