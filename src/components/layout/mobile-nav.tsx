'use client';

/**
 * 移动端导航抽屉
 *
 * 触发器:右上角汉堡按钮 ☰
 * 内容:主链接(大字 / 图标)+ 二线链接(小字)+ 底部社交链接
 * 关闭:点 backdrop / 点 X / 点链接
 */
import { useEffect, useState } from 'react';
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

      {/* Backdrop · 不透明,挡掉页面所有交互;同时挡住 SiteHeader 的 backdrop-blur 透出 */}
      <div
        onClick={() => setOpen(false)}
        className={`sm:hidden fixed inset-0 z-[60] bg-black/70 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      />

      {/* Drawer · 直接写 hex bg,不依赖任何 CSS 变量(变量在某些渲染上下文里没解析) */}
      <aside
        style={{
          backgroundColor: '#13151A',
          backgroundImage: 'none',
        }}
        className={`sm:hidden fixed top-0 right-0 bottom-0 z-[61] w-[85vw] max-w-sm border-l border-zinc-700 shadow-[-12px_0_32px_rgba(0,0,0,0.6)] transform transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <Link href="/" onClick={() => setOpen(false)}>
            <Logo variant="full" size={22} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="h-11 w-11 -mr-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="overflow-y-auto h-[calc(100vh-65px)] p-4 space-y-6">
          {/* 主功能 · 大字 */}
          <div className="space-y-1">
            {mainLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                // 48px row,易点
                className="flex items-center px-3 py-3 rounded-md hover:bg-muted/40 transition-colors text-base font-medium text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* 更多 · 二级 */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium pb-1">
              {moreLabel}
            </div>
            {moreLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center px-3 py-2.5 rounded-md hover:bg-muted/40 transition-colors text-sm text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* 社交 */}
          <div className="border-t border-border/40 pt-4 flex gap-3 px-3 text-xs text-muted-foreground">
            <a
              href="https://x.com/Ocufi_io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              𝕏 Twitter
            </a>
            <a
              href="https://github.com/rowanrowan548-maker/ocufi-web"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </nav>
      </aside>
    </>
  );
}
