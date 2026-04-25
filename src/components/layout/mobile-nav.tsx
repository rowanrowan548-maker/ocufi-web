'use client';

/**
 * 移动端导航抽屉(Portal 版)
 *
 * 用 createPortal 把 backdrop + drawer 渲染到 document.body 直下,
 * 完全脱离 SiteHeader 的 CSS 上下文(避免 backdrop-blur / 父级 stacking
 * / opacity 等导致的诡异透明问题)
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';

export interface NavItem {
  href: string;
  label: string;
}

interface Props {
  mainLinks: NavItem[];
  moreLinks: NavItem[];
  moreLabel: string;
}

export function MobileNav({ mainLinks, moreLinks, moreLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // SSR 期间 document 不存在,先标记 mounted
  useEffect(() => { setMounted(true); }, []);

  // 打开时锁定 body 滚动
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // 抽屉本身用 Portal 挂到 body,backdrop + 抽屉一起
  const drawer = mounted && (
    <>
      {/* Backdrop · 纯黑 70% 完全挡住底层 */}
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
        className="sm:hidden"
        aria-hidden={!open}
      />

      {/* Drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '85vw',
          maxWidth: '320px',
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
        className="sm:hidden flex flex-col"
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
            padding: 16,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* 主功能 · 大字 */}
          <div>
            {mainLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 500,
                  color: '#fafafa',
                  textDecoration: 'none',
                }}
                className="hover:bg-zinc-800/60"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* 更多 · 二级 */}
          <div>
            <div
              style={{
                padding: '0 12px 8px',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#71717a',
                fontWeight: 500,
              }}
            >
              {moreLabel}
            </div>
            {moreLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  color: '#a1a1aa',
                  textDecoration: 'none',
                }}
                className="hover:bg-zinc-800/60 hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* 社交 */}
          <div
            style={{
              borderTop: '1px solid rgb(39 39 42)',
              paddingTop: 16,
              display: 'flex',
              gap: 12,
              padding: '16px 12px 0',
              fontSize: 12,
              color: '#a1a1aa',
            }}
          >
            <a
              href="https://x.com/Ocufi_io"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
              className="hover:text-foreground"
            >
              𝕏 Twitter
            </a>
            <a
              href="https://github.com/rowanrowan548-maker/ocufi-web"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
              className="hover:text-foreground"
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
        // 44px tap target
        className="sm:hidden h-11 w-11 -mr-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
      {drawer && createPortal(drawer, document.body)}
    </>
  );
}
