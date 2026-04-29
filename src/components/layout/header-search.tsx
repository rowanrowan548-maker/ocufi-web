'use client';

/**
 * T-911 / T-SEARCH-MODAL · 顶部全局币种搜索
 *
 * - 桌面 lg+:中间 inline trigger 按钮(Search 图标 + 占位文本 + / 快捷键 hint),click → 大 modal
 * - 移动 < lg:Search 图标按钮 → 同 modal(尺寸自适应)
 * - 全局键盘:`/` 或 `⌘K` 任意页打开 modal
 *
 * T-SEARCH-MODAL 之前用 TokenSearchCombo 做窄下拉,体验跟 OKX 大 modal 差距大
 * 现统一走 HeaderSearchModal,header-search 只负责 trigger + 全局快捷键
 */
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HeaderSearchModal } from './header-search-modal';

export function HeaderSearch() {
  const t = useTranslations();
  const [modalOpen, setModalOpen] = useState(false);

  // 全局快捷键 Cmd+K / Ctrl+K / "/"
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
      setModalOpen(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* 桌面 inline trigger · 宽度由父容器 flex-1 控制(吃满中间空间) */}
      <div className="hidden lg:block w-full min-w-[320px] max-w-2xl">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full inline-flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 h-9 text-left text-sm text-muted-foreground hover:border-primary/30 hover:bg-muted/50 transition-colors focus-visible:outline-none"
          aria-label={t('nav.search.placeholder')}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1 truncate text-xs">
            {t('nav.search.placeholder')}
          </span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-background border border-border/40 text-muted-foreground/70 font-mono flex-shrink-0">
            /
          </kbd>
          <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-background border border-border/40 text-muted-foreground/70 font-mono flex-shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* 移动 search 图标 trigger */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-label={t('nav.search.placeholder')}
        className="lg:hidden h-11 w-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="h-5 w-5" />
      </button>

      <HeaderSearchModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
