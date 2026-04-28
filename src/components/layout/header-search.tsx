'use client';

/**
 * T-911 · 顶部全局币种搜索
 *
 * - 桌面 lg+:inline 输入框,240-320px,占位"币种 / 地址 / DApp..."
 * - 移动 < lg:Search 图标 → 全屏 Sheet 弹搜索面板
 * - 选中 → 跳 /trade?mint=X
 * - 桌面快捷键 / 或 Cmd+K 聚焦
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TokenSearchCombo } from '@/components/common/token-search-combo';

export function HeaderSearch() {
  const t = useTranslations();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);

  function handleSelect(mint: string) {
    router.push(`/trade?mint=${mint}`);
    setMobileOpen(false);
  }

  // T-911:桌面快捷键 Cmd+K / Ctrl+K / "/"
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      const inEditable =
        tgt &&
        (tgt.tagName === 'INPUT' ||
          tgt.tagName === 'TEXTAREA' ||
          tgt.isContentEditable);
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash = e.key === '/' && !inEditable;
      if (!isCmdK && !isSlash) return;
      e.preventDefault();
      // 桌面优先聚焦,小屏走 sheet
      if (window.matchMedia('(min-width: 1024px)').matches) {
        const trigger = desktopRef.current?.querySelector<HTMLElement>('[data-search-trigger]');
        trigger?.click();
      } else {
        setMobileOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* 桌面 inline */}
      <div
        ref={desktopRef}
        className="hidden lg:block w-[320px] xl:w-[400px]"
      >
        <TokenSearchCombo
          value=""
          onSelect={handleSelect}
          renderTrigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              data-search-trigger
              className="w-full inline-flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 h-9 text-left text-sm text-muted-foreground hover:border-primary/30 hover:bg-muted/50 transition-colors focus-visible:outline-none"
              aria-label={t('nav.search.placeholder')}
            >
              <Search className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="flex-1 truncate text-xs">
                {t('nav.search.placeholder')}
              </span>
              <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-background border border-border/40 text-muted-foreground/70 font-mono">
                ⌘K
              </kbd>
            </button>
          )}
        />
      </div>

      {/* 移动 search 图标 trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={t('nav.search.placeholder')}
        className="lg:hidden h-11 w-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* 移动全屏 sheet */}
      {mobileOpen && (
        <MobileSearchSheet onClose={() => setMobileOpen(false)} onSelect={handleSelect} />
      )}
    </>
  );
}

function MobileSearchSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (mint: string) => void;
}) {
  const t = useTranslations();

  // 锁滚 + ESC 关
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="lg:hidden"
      style={{ position: 'fixed', inset: 0, zIndex: 70 }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#13151A',
          borderBottom: '1px solid rgb(63 63 70)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: '85vh',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {t('nav.search.placeholder')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 -mr-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <TokenSearchCombo value="" onSelect={onSelect} />
      </div>
    </div>
  );
}
