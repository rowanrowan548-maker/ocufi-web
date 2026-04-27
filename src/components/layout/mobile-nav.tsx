'use client';

/**
 * T-908a · 移动端导航抽屉(Portal 版)· 5 组折叠 + 底部设置块
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { NAV_ENTRIES } from './nav-config';
import { SettingsMenu } from './settings-menu';

export function MobileNav() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const drawer = mounted && (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          backgroundColor: 'rgba(0,0,0,0.7)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms',
        }}
        className="lg:hidden"
        aria-hidden={!open}
      />

      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '85vw',
          maxWidth: '340px',
          zIndex: 61,
          backgroundColor: '#13151A',
          backgroundImage: 'none',
          borderLeft: '1px solid rgb(63 63 70)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.6)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms',
          color: '#fafafa',
          isolation: 'isolate',
        }}
        className="lg:hidden flex flex-col"
        aria-hidden={!open}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgb(39 39 42)',
            flexShrink: 0,
          }}
        >
          <Link href="/" onClick={() => setOpen(false)}>
            <Logo variant="full" size={45} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            style={{
              height: 44,
              width: 44,
              marginRight: -8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a1a1aa',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav
          style={{
            overflowY: 'auto',
            padding: 12,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {NAV_ENTRIES.map((entry, i) => {
            if (entry.type === 'link') {
              return (
                <Link
                  key={i}
                  href={entry.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block',
                    padding: '12px',
                    borderRadius: 6,
                    fontSize: 16,
                    fontWeight: 500,
                    color: '#fafafa',
                    textDecoration: 'none',
                  }}
                  className="hover:bg-zinc-800/60"
                >
                  {t(entry.labelKey)}
                </Link>
              );
            }
            return (
              <details
                key={i}
                className="group"
                style={{ borderRadius: 6, overflow: 'hidden' }}
              >
                <summary
                  className="hover:bg-zinc-800/60"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#fafafa',
                    cursor: 'pointer',
                    listStyle: 'none',
                  }}
                >
                  <span>{t(entry.labelKey)}</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:-rotate-180" />
                </summary>
                <div style={{ padding: '4px 8px 8px 8px' }}>
                  {entry.items.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 6,
                        fontSize: 14,
                        color: it.placeholder ? '#71717a' : '#a1a1aa',
                        textDecoration: 'none',
                      }}
                      className="hover:bg-zinc-800/60 hover:!text-foreground"
                    >
                      <span>{t(it.labelKey)}</span>
                      {it.placeholder && (
                        <span
                          style={{
                            fontSize: 9,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: '#19FB9B',
                            fontFamily: 'var(--font-mono)',
                            opacity: 0.7,
                          }}
                        >
                          {t('nav.comingSoon')}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}

          {/* 底部设置块 */}
          <div
            style={{
              borderTop: '1px solid rgb(39 39 42)',
              marginTop: 8,
              padding: '12px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#71717a',
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              {t('settings.title')}
            </div>
            <SettingsMenu inline />
          </div>

          {/* 社交 */}
          <div
            style={{
              borderTop: '1px solid rgb(39 39 42)',
              marginTop: 8,
              padding: '12px',
              display: 'flex',
              gap: 12,
              fontSize: 12,
              color: '#a1a1aa',
            }}
          >
            <a
              href="https://x.com/Ocufi_io"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
              className="hover:!text-foreground"
            >
              𝕏 Twitter
            </a>
            <a
              href="https://github.com/rowanrowan548-maker/ocufi-web"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
              className="hover:!text-foreground"
            >
              GitHub
            </a>
          </div>
        </nav>
      </aside>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="lg:hidden h-11 w-11 -mr-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
      {drawer && createPortal(drawer, document.body)}
    </>
  );
}
