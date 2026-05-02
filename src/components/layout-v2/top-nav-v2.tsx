'use client';

/**
 * T-UI-OVERHAUL Stage 5.4 + 5.4-HOTFIX · 顶部 nav · luxury frosted
 *
 * mockup ref: `.nav` · 72px 高 · sticky · backdrop-blur 24 saturate 180% ·
 *             logo + 3 主 tab(交易/持仓/奖励)+ ⋯ + wallet
 *
 * Logo:inline src/app/icon.svg 真 logo · 严禁动 4 段弧 + 中心瞳点
 *
 * 5.4-HOTFIX 修 5 个 P0 回归(用户实测 mobile 卡死):
 *  1. 搜索框没了 → 接回 HeaderSearch(桌面吃中间 flex-1 · 移动 search 图标)
 *  2. 限价单 /limit 用户拍板拿掉 → 删 MORE_ITEMS 行 + i18n key
 *  3. MoreMenu 11 项太多 → 砍至 4 项(积分/邀请/徽章/设置)· 其他 URL 直访仍可
 *  4. Logo 24px 太小 → mobile 28 / desktop 32
 *  5. 🆘 mobile ⋯ 弹关不掉 + 卡死 → mousedown→pointerdown(iOS 触屏)
 *     + MoreMenu mobile 改 solid bg 不 blur(双层 backdrop blur iOS Safari 卡死)
 */
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ConnectWalletButton } from '@/components/wallet/connect-wallet-button';
import { HeaderSearch } from '@/components/layout/header-search';

const MAIN_TABS: { href: string; key: 'trade' | 'portfolio' | 'rewards' }[] = [
  { href: '/trade', key: 'trade' },
  { href: '/portfolio', key: 'portfolio' },
  { href: '/rewards', key: 'rewards' },
];

// 5.4-HOTFIX #3 · 11 项 → 4 项 · 其他 (watchlist/limit/alerts/history/status/docs/faq)
// URL 直接访问仍 work · 只是 nav 不显 · 减少认知负担
const MORE_ITEMS: { href: string; key: 'points' | 'invite' | 'badges' | 'settings' }[] = [
  { href: '/points', key: 'points' },
  { href: '/invite', key: 'invite' },
  { href: '/badges', key: 'badges' },
  { href: '/settings', key: 'settings' },
];

export function TopNavV2() {
  const t = useTranslations('landingV2.navV2');
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // 5.4-HOTFIX #5 · pointerdown 替代 mousedown(iOS 触屏不发 mousedown · 弹了关不掉)
  useEffect(() => {
    if (!moreOpen) return;
    function onDocPointer(e: PointerEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false);
    }
    window.addEventListener('pointerdown', onDocPointer);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('pointerdown', onDocPointer);
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
        className="flex items-center mx-auto gap-3 lg:gap-6"
        style={{
          height: '72px',
          padding: '0 16px',
          maxWidth: '1240px',
        }}
      >
        {/* Logo · inline icon.svg(spec L73 严禁动)· 5.4-HOTFIX #4 mobile 28 / desktop 32 */}
        <Link
          href="/"
          className="flex items-center flex-shrink-0"
          aria-label="Ocufi"
          style={{
            fontFamily: 'var(--font-geist), -apple-system, sans-serif',
            fontWeight: 600,
            fontSize: '17px',
            letterSpacing: '-0.02em',
            marginRight: '24px',
            color: 'var(--ink-100)',
            gap: '10px',
            textDecoration: 'none',
          }}
        >
          <span className="md:hidden">
            <OcufiLogoSvg size={28} />
          </span>
          <span className="hidden md:inline-flex">
            <OcufiLogoSvg size={32} />
          </span>
          <span className="hidden sm:inline">OCUFI</span>
        </Link>

        {/* 桌面 3 主 tab */}
        <div className="hidden md:flex items-center gap-9 flex-shrink-0">
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

        {/* 5.4-HOTFIX #1 · HeaderSearch · 桌面吃中间 flex-1 · 移动是 search 图标(图标自带 lg 切换) */}
        <div className="flex flex-1 items-center justify-center min-w-0">
          <HeaderSearch />
        </div>

        {/* 右侧 · ⋯ + wallet */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((p) => !p)}
              aria-label={t('more')}
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                fontSize: '20px',
                lineHeight: 1,
                letterSpacing: '2px',
                color: moreOpen ? 'var(--ink-100)' : 'var(--ink-60)',
                background: 'none',
                border: 'none',
                transition: 'color 200ms',
                minHeight: '40px',
              }}
            >
              ⋯
            </button>
            {moreOpen && <MoreMenu onClose={() => setMoreOpen(false)} t={t} />}
          </div>

          {/* wallet 用现有 ConnectWalletButton · 替换文案不动逻辑 */}
          <div style={{ minWidth: '110px' }}>
            <ConnectWalletButton />
          </div>
        </div>
      </nav>

      {/* 移动 · 3 主 tab 折在 nav 下方一行 */}
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
      // 5.4-HOTFIX #5 · 给 menu 也加 onPointerDown stopPropagation · 防 outside 检测误关
      onPointerDown={(e) => e.stopPropagation()}
      // 5.4-HOTFIX #5 · mobile 改 solid 背景 + 不 blur · 桌面 lg+ 才走 luxury blur
      // 双层 backdrop-filter blur(header + menu)在 iOS Safari 实测会卡死页面
      // mobile 用纯 solid 色(--bg-deep 实色 #0E1117)
      // 桌面 lg+(屏大 + GPU 强)安全开 blur
      className="more-menu-v2"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        minWidth: '180px',
        border: '1px solid var(--border-strong)',
        borderRadius: '12px',
        padding: '8px',
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
            padding: '12px 14px',
            fontSize: '13px',
            color: 'var(--ink-80)',
            textDecoration: 'none',
            borderRadius: '8px',
            transition: 'all 150ms',
            fontFamily: 'var(--font-geist), -apple-system, sans-serif',
            // mobile 触控热区
            minHeight: '40px',
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

function OcufiLogoSvg({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
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
  );
}

function stripLocale(p: string): string {
  // /zh-CN/trade → /trade · /en-US/portfolio → /portfolio · / → /
  const m = p.match(/^\/(zh-CN|en-US)(\/.*)?$/);
  if (m) return m[2] ?? '/';
  return p;
}
