'use client';

/**
 * T-980-118 · /docs sticky 全文搜索框 + Cmd+K
 *
 * 后端: GET /search/docs?q=&limit= (T-952 已 ship · 返 SearchHit[])
 *
 * 行为:
 *  - sticky top · 全宽 input
 *  - Cmd+K (Mac) / Ctrl+K (Win) 聚焦
 *  - debounced 300ms · 输入即查
 *  - 结果列下拉 max 10 · 命中 token 高亮 <mark>
 *  - 点结果 → 跳锚点 /docs#section-{id}(BE → FE 映射)
 */
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, Loader2, X } from 'lucide-react';
import { searchDocs, type SearchHit, isApiConfigured } from '@/lib/api-client';

// T-980-118 · BE doc ID → FE section anchor 映射 · 现 FE 有 6 章节(connect/buy/sell/limit/safety/watchlist)
// 后端有 6 不同章节(doc-getting-started/doc-trade/doc-alerts/doc-portfolio/doc-history/doc-invite)
// 此映射给最接近的 FE section · 不完美但比跳到顶部好
const BE_TO_FE_ANCHOR: Record<string, string> = {
  'doc-getting-started': 'section-connect',
  'doc-trade': 'section-buy',
  'doc-alerts': 'section-limit',
  'doc-portfolio': 'section-sell',
  'doc-history': 'section-sell',
  'doc-invite': 'section-safety',
};

const DEBOUNCE_MS = 300;

export function DocsSearch() {
  const t = useTranslations('docs.search');
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K · 全局监听
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // debounced 查
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); setLoading(false); return; }
    if (!isApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await searchDocs(term, 10);
        if (!cancelled) setHits(r.items);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q]);

  function handleResultClick(id: string) {
    const anchor = BE_TO_FE_ANCHOR[id] ?? '';
    if (anchor) {
      window.location.hash = anchor;
    }
    setOpen(false);
    setQ('');
  }

  const showDropdown = open && q.trim().length > 0;

  return (
    <div className="sticky top-12 sm:top-20 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-background/95 backdrop-blur">
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground/60 pointer-events-none" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="w-full h-10 pl-9 pr-20 rounded-md border border-border/40 bg-card/40 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:bg-card transition-colors"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" aria-hidden="true" />}
            {q && !loading && (
              <button
                type="button"
                onClick={() => { setQ(''); inputRef.current?.focus(); }}
                aria-label={t('clear')}
                className="p-0.5 text-muted-foreground/60 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1 py-0.5 font-mono">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* 结果下拉 */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-md border border-border/40 bg-popover shadow-md ring-1 ring-foreground/10 max-h-[60vh] overflow-y-auto">
            {hits === null && loading && (
              <div className="p-4 text-xs text-muted-foreground/60 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('searching')}
              </div>
            )}
            {hits !== null && hits.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground/60 text-center">
                {t('noResults', { q })}
              </div>
            )}
            {hits !== null && hits.length > 0 && (
              <ul className="py-1">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleResultClick(h.id); }}
                      className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors block"
                    >
                      <div className="text-sm font-medium">
                        <Highlight text={isZh ? h.title_zh : h.title_en} q={q} />
                      </div>
                      {h.snippet && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          <Highlight text={h.snippet} q={q} />
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 命中 token 用 <mark> 高亮(大小写不敏感 · 不破坏 React 节点)
function Highlight({ text, q }: { text: string; q: string }) {
  const term = q.trim();
  if (!term) return <>{text}</>;
  // 简单分词:按非字母数字切,英文 token 长度 ≥ 2 才高亮(避免单字符过分高亮)
  const tokens = Array.from(
    new Set(
      term
        .toLowerCase()
        .split(/[\s,，.。]+/)
        .filter((t) => t.length >= 2 || /[一-鿿]/.test(t)),
    ),
  );
  if (tokens.length === 0) return <>{text}</>;
  // 按 token 切串(escape regex 特殊字符)
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  const matchSet = new Set(tokens);
  return (
    <>
      {parts.map((p, i) =>
        matchSet.has(p.toLowerCase())
          ? <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">{p}</mark>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}
