'use client';

/**
 * T-UI-OVERHAUL Stage 5.4 · 顶部 nav · luxury frosted
 *
 * mockup ref: `.nav` · 72px 高 · sticky · backdrop-blur 24 saturate 180% ·
 *             logo + 3 主 tab(交易/持仓/奖励)+ ⋯ + wallet
 *
 * Logo:inline src/app/icon.svg 真 logo · 严禁动 4 段弧 + 中心瞳点
 * MoreMenu:点 ⋯ 弹下拉 · 含原 5 分组的次要项 · click outside 关
 */
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';

const MAIN_TABS: { href: string; key: 'trade' | 'portfolio' | 'rewards' }[] = [
  { href: '/trade', key: 'trade' },
  { href: '/portfolio', key: 'portfolio' },
  { href: '/rewards', key: 'rewards' },
];

const MORE_ITEMS: { href: string; key: keyof MoreItemsT }[] = [
  { href: '/watchlist', key: 'watchlist' },
  { href: '/limit', key: 'limit' },
  { href: '/alerts', key: 'alerts' },
  { href: '/history', key: 'history' },
  { href: '/points', key: 'points' },
  { href: '/invite', key: 'invite' },
  { href: '/badges', key: 'badges' },
  { href: '/status', key: 'status' },
  { href: '/settings', key: 'settings' },
  { href: '/docs', key: 'docs' },
  { href: '/faq', key: 'faq' },
];

type MoreItemsT = {
  watchlist: string;
  limit: string;
  alerts: string;
  history: string;
  points: string;
  invite: string;
  badges: string;
  status: string;
  settings: string;
  docs: string;
  faq: string;
};

export function TopNavV2() {
  const t = useTranslations('landingV2.navV2');
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // 点外面关
  useEffect(() => {
    if (!moreOpen) return;
    function onDocClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false);
    }
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [moreOpen]);

  // path active 检测 · 去掉 locale 前缀(/zh-CN/trade → /trade)
  const stripped = stripLocale(pathname);

  return (
    <header
      className="sticky top-0 w-full"
      style={{
        zIndex: 100,
        background: 'rgba(11, 13, 18, 0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid var(--border-v2)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <nav
        className="flex items-center mx-auto"
        style={{
          height: '72px',
          padding: '0 24px',
          maxWidth: '1240px',
        }}
      >
        {/* Logo · inline icon.svg(spec L73 严禁动)*/}
        <Link
          href="/"
          className="flex items-center"
          aria-label="Ocufi"
          style={{
            fontFamily: 'var(--font-geist), -apple-system, sans-serif',
            fontWeight: 600,
            fontSize: '17px',
            letterSpacing: '-0.02em',
            marginRight: '48px',
            color: 'var(--ink-100)',
            gap: '10px',
            textDecoration: 'none',
          }}
        >
          <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden>
            <path
              d="M 16 5 A 11 11 0 0 1 27 16"
              stroke="#19FB9B"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 16 27 A 11 11 0 0 1 5 16"
              stroke="#19FB9B"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 27 16 A 11 11 0 0 1 16 27"
              stroke="#19FB9B"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
              opacity="0.3"
            />
            <path
              d="M 5 16 A 11 11 0 0 1 16 5"
              stroke="#19FB9B"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
              opacity="0.3"
            />
            <circle cx="16" cy="16" r="2.2" fill="#19FB9B" />
          </svg>
          OCUFI
        </Link>

        {/* 桌面 3 主 tab */}
        <div className="hidden md:flex items-center gap-9 flex-1">
          {MAIN_TABS.map(({ href, key }) => {
            const active = stripped === href || stripped.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                style={{
                  textDecoration: 'none',
                  color: active ? 'var(--ink-100)' : 'var(--ink-60)',
                  fontSize: '14px',
                  fontWeight: 500,
                  padding: '26px 0',
                  position: 'relative',
                  transition: 'color 200ms',
                  letterSpacing: '-0.005em',
                }}
              >
                {t(key)}
                {active && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: '-1px',
                      height: '1.5px',
                      background: 'var(--brand-up)',
                      boxShadow: '0 0 12px var(--brand-glow)',
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* 移动 · 主 tab 走抽屉(暂略 · 用 ⋯ 当兜底) */}
        <div className="md:hidden flex-1" />

        {/* 右侧 · ⋯ + wallet */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-auto md:ml-0">
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((p) => !p)}
              aria-label={t('more')}
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                fontSize: '18px',
                letterSpacing: '2px',
                color: moreOpen ? 'var(--ink-100)' : 'var(--ink-60)',
                background: 'none',
                border: 'none',
                transition: 'color 200ms',
              }}
            >
              ⋯
            </button>
            {moreOpen && (
              <MoreMenu onClose={() => setMoreOpen(false)} t={t} />
            )}
          </div>

          {/* wallet 用现有 ConnectWalletButton · 替换文案不动逻辑 */}
          <div style={{ minWidth: '110px' }}>
            <ConnectWalletButton />
          </div>
        </div>
      </nav>

      {/* 移动 · 3 主 tab 显在 nav 下方一行(避免 mobile 1280px 以下挤压) */}
      <nav
        className="md:hidden flex items-center justify-around"
        style={{
          padding: '0 16px 8px',
          gap: '12px',
        }}
      >
        {MAIN_TABS.map(({ href, key }) => {
          const active = stripped === href || stripped.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px',
                color: active ? 'var(--ink-100)' : 'var(--ink-60)',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
                borderBottom: active ? '1.5px solid var(--brand-up)' : '1.5px solid transparent',
                transition: 'all 200ms',
              }}
            >
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

// ─── MoreMenu 下拉 ─────────────────────────────────

function MoreMenu({
  onClose,
  t,
}: {
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        minWidth: '220px',
        background: 'rgba(14, 17, 23, 0.95)',
        border: '1px solid var(--border-strong)',
        borderRadius: '12px',
        padding: '8px',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: 'var(--shadow-elev)',
        zIndex: 200,
      }}
    >
      {MORE_ITEMS.map(({ href, key }) => (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          style={{
            display: 'block',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--ink-80)',
            textDecoration: 'none',
            borderRadius: '8px',
            transition: 'all 150ms',
            fontFamily: 'var(--font-geist), -apple-system, sans-serif',
          }}
          className="more-menu-item-v2"
        >
          {t(`moreItems.${key}`)}
        </Link>
      ))}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────

function stripLocale(p: string): string {
  // /zh-CN/trade → /trade · /en-US/portfolio → /portfolio · / → /
  const m = p.match(/^\/(zh-CN|en-US)(\/.*)?$/);
  if (m) return m[2] ?? '/';
  return p;
}
