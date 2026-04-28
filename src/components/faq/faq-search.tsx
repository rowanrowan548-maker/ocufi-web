'use client';

/**
 * T-FAQ-124 · /faq sticky 全文搜索框 + Cmd+K + `/`
 *
 * 后端: GET /search/faq?q=&limit= (T-952 已 ship · 返 SearchHit[])
 *
 * 行为:
 *  - sticky top · 全宽 input
 *  - Cmd+K (Mac) / Ctrl+K (Win) / `/` 聚焦
 *  - debounced 300ms · 输入即查
 *  - 结果列下拉 max 10 · 命中 token 高亮 <mark>
 *  - 点结果 → 匹配 FE items 找 idx → window.location.hash = `faq-item-{idx}`
 *    FaqView 监听 hashchange 展开 + 滚动到对应 item
 */
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, Loader2, X } from 'lucide-react';
import { searchFaq, type SearchHit, isApiConfigured } from '@/lib/api-client';

const DEBOUNCE_MS = 300;

interface FaqItem {
  group: string;
  q: string;
  a: string;
}

export function FaqSearch() {
  const t = useTranslations('faq.search');
  const tFaq = useTranslations('faq');
  const items = tFaq.raw('items') as FaqItem[];
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K / `/` · 全局监听
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === '/' && !inField) {
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

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); setLoading(false); return; }
    if (!isApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await searchFaq(term, 10);
        if (!cancelled) setHits(r.items);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q]);

  function handleResultClick(hit: SearchHit) {
    // BE title_zh / title_en 即问题文案 · 直接和 FE items 的 q 比对找 idx
    const target = isZh ? hit.title_zh : hit.title_en;
    const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const targetNorm = norm(target);
    let idx = items.findIndex((it) => norm(it.q) === targetNorm);
    if (idx < 0) {
      idx = items.findIndex((it) => norm(it.q).includes(targetNorm) || targetNorm.includes(norm(it.q)));
    }
    if (idx >= 0) {
      // 先清 hash 再设新值,确保 hashchange 总会 fire(即使点的是同一条)
      window.location.hash = '';
      window.location.hash = `faq-item-${idx}`;
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
            className="w-full h-10 pl-9 pr-24 rounded-md border border-border/40 bg-card/40 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:bg-card transition-colors"
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
            <kbd className="hidden lg:inline-flex items-center text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1 py-0.5 font-mono">
              /
            </kbd>
            <kbd className="hidden xl:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1 py-0.5 font-mono">
              ⌘K
            </kbd>
          </div>
        </div>

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
                      onMouseDown={(e) => { e.preventDefault(); handleResultClick(h); }}
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

function Highlight({ text, q }: { text: string; q: string }) {
  const term = q.trim();
  if (!term) return <>{text}</>;
  const tokens = Array.from(
    new Set(
      term
        .toLowerCase()
        .split(/[\s,,.。]+/)
        .filter((t) => t.length >= 2 || /[一-鿿]/.test(t)),
    ),
  );
  if (tokens.length === 0) return <>{text}</>;
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
