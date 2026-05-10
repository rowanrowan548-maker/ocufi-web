'use client';

/**
 * P5-FE-21 · V2 footer · 法律链接 + 社交按钮 + version
 *
 * 桌面 flex space-between · mobile 折 2 行 · 玻璃面板 + 顶 1px brand glow 分隔
 * mobile 自带 margin-bottom 80px 给 fixed BottomTabBar 让位
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FooterVersion } from '@/components/landing/footer-version';

const LEGAL = [
  { key: 'privacy', href: '/legal/privacy' },
  { key: 'terms', href: '/legal/terms' },
  { key: 'disclaimer', href: '/legal/disclaimer' },
  { key: 'audit', href: '/legal/audit' },
] as const;

const SOCIAL = [
  { label: '𝕏', title: 'Twitter / X · @Ocufi_io', href: 'https://x.com/Ocufi_io' },
  { label: 'Telegram', title: 'Telegram community', href: 'https://t.me/+HucmvmOx2IswZDBl' },
  { label: 'GitHub', title: 'Frontend source', href: 'https://github.com/rowanrowan548-maker/ocufi-web' },
] as const;

export function FooterV2() {
  const t = useTranslations('v2.footer');

  return (
    <footer
      className="v2-footer"
      style={{
        borderTop: '1px solid var(--border-strong, rgba(255,255,255,0.14))',
        background: 'var(--brand-soft, rgba(25,251,155,0.04))',
        padding: '24px 56px',
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
        fontSize: 12,
        color: 'var(--ink-60)',
      }}
    >
      <div
        className="v2-footer-row"
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* 左 · 法律链接 */}
        <nav
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
          aria-label="legal"
        >
          {LEGAL.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="v2-footer-link"
              style={{
                color: 'var(--ink-60)',
                textDecoration: 'none',
                transition: 'color 120ms ease',
              }}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* 右 · 社交 + version */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 11,
              color: 'var(--ink-40)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {t('followUs')}
          </span>
          {SOCIAL.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              title={s.title}
              className="v2-footer-link"
              style={{
                color: 'var(--ink-60)',
                textDecoration: 'none',
                transition: 'color 120ms ease',
              }}
            >
              {s.label}
            </a>
          ))}
          <span
            style={{
              fontSize: 11,
              color: 'var(--ink-40)',
              letterSpacing: '0.04em',
              marginLeft: 6,
            }}
          >
            v2.0.0 · <FooterVersion />
          </span>
        </div>
      </div>
    </footer>
  );
}
