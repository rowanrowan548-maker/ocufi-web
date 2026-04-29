'use client';

/**
 * T-SEARCH-MODAL · OKX 风顶部搜索大 modal
 *
 * 桌面 lg+:全屏 backdrop + 居中 max-w-2xl 卡(max-h 80vh)
 * 移动 < lg:同 modal 但占满宽度(max-w 改 100vw,圆角去掉)
 *
 * 内容(从上到下):
 *   1. Header:大输入框 autoFocus + 粘贴合约按钮 + 关闭 X
 *   2. 历史搜索 chips · localStorage `ocufi.search.history.v1` · 最多 5 条
 *   3. Tabs:代币 / DApp · DApp 占位 comingSoon
 *   4. 表格列表:#/名称/价格/流动性/1h 成交/市值 · 行 click → /trade?mint=
 *      默认 trending top 20 · 输入后切 searchTokens 远端 · 350ms 防抖
 *
 * 键盘:Esc 关 · ↑↓ 选 · Enter 跳
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, X, ClipboardPaste, Loader2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { PublicKey } from '@solana/web3.js';
import { fetchMarketsTrending, type MarketItem } from '@/lib/api-client';
import { searchTokens, type TokenInfo } from '@/lib/portfolio';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface RowItem {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volumeH24: number | null;
  marketCapUsd: number | null;
  priceChange24h: number | null;
}

interface HistoryItem {
  mint: string;
  symbol: string;
  logo: string | null;
}

const HISTORY_KEY = 'ocufi.search.history.v1';
const HISTORY_MAX = 5;

function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

function loadHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, HISTORY_MAX).filter((x: unknown): x is HistoryItem => {
      const v = x as HistoryItem;
      return !!v && typeof v.mint === 'string' && typeof v.symbol === 'string';
    });
  } catch {
    return [];
  }
}

function saveHistory(item: HistoryItem) {
  if (typeof window === 'undefined') return;
  try {
    const cur = loadHistory().filter((x) => x.mint !== item.mint);
    const next = [item, ...cur].slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* localStorage quota / disabled */
  }
}

function clearHistory() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* noop */
  }
}

export function HeaderSearchModal({ open, onClose }: Props) {
  const t = useTranslations('nav.searchModal');
  const router = useRouter();
  const locale = useLocale();
  const [tab, setTab] = useState<'tokens' | 'dapps'>('tokens');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [trending, setTrending] = useState<MarketItem[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [searchHits, setSearchHits] = useState<TokenInfo[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNavigate = useCallback(
    (item: { mint: string; symbol: string; logo: string | null }) => {
      // T-FIX-SEARCH-CLICK · 顺序:先 push 再 saveHistory 再 close
      // localePrefix=as-needed 下,默认 locale (zh-CN) 不加前缀,其他显式带
      const path =
        locale === 'zh-CN'
          ? `/trade?mint=${item.mint}`
          : `/${locale}/trade?mint=${item.mint}`;
      router.push(path);
      saveHistory({ mint: item.mint, symbol: item.symbol, logo: item.logo });
      onClose();
    },
    [router, onClose, locale],
  );

  // open 切 true 时 reset state + autofocus
  useEffect(() => {
    if (!open) return;
    setInput('');
    setActiveIdx(0);
    setHistory(loadHistory());
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [open]);

  // 锁滚 + Esc 关
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  // 拉 trending 一次(modal 第一次打开)
  useEffect(() => {
    if (!open || trending.length || trendingLoading) return;
    setTrendingLoading(true);
    fetchMarketsTrending('1h', 20)
      .then((items) => setTrending(items))
      .catch(() => setTrending([]))
      .finally(() => setTrendingLoading(false));
  }, [open, trending.length, trendingLoading]);

  // 输入合法 mint 直接跳
  useEffect(() => {
    const q = input.trim();
    if (!isValidMint(q)) return;
    handleNavigate({ mint: q, symbol: q.slice(0, 4) + '…', logo: null });
  }, [input, handleNavigate]);

  // 远端搜索 · 输入 >= 2 字符时 350ms 防抖
  useEffect(() => {
    const q = input.trim();
    if (q.length < 2 || isValidMint(q)) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const id = setTimeout(() => {
      searchTokens(q, 30)
        .then((hits) => setSearchHits(hits))
        .catch(() => setSearchHits([]))
        .finally(() => setSearchLoading(false));
    }, 350);
    return () => clearTimeout(id);
  }, [input]);

  // 当前显示的行(trending 或 search hits)
  const rows: RowItem[] = useMemo(() => {
    if (tab !== 'tokens') return [];
    const q = input.trim();
    if (q.length === 0) {
      return trending.map((m) => ({
        mint: m.mint,
        symbol: m.symbol,
        name: m.name,
        logo: m.logo,
        priceUsd: m.priceUsd,
        liquidityUsd: m.liquidityUsd,
        volumeH24: m.volumeH24,
        marketCapUsd: m.marketCapUsd,
        priceChange24h: m.change24h,
      }));
    }
    return searchHits.map((h) => ({
      mint: h.mint,
      symbol: h.symbol,
      name: h.name,
      logo: h.logoUri ?? null,
      priceUsd: h.priceUsd,
      liquidityUsd: h.liquidityUsd,
      volumeH24: h.volume24h ?? null,
      marketCapUsd: h.marketCap,
      priceChange24h: h.priceChange24h ?? null,
    }));
  }, [tab, input, trending, searchHits]);

  // ↑↓ Enter
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (rows.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(rows.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        const r = rows[activeIdx];
        if (r) {
          e.preventDefault();
          handleNavigate({ mint: r.mint, symbol: r.symbol, logo: r.logo });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, rows, activeIdx, handleNavigate]);

  async function onPaste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return;
      setInput(text);
      setPasteToast(t('pasted'));
      setTimeout(() => setPasteToast(null), 1200);
    } catch {
      setPasteToast(t('pasteFail'));
      setTimeout(() => setPasteToast(null), 1500);
    }
  }

  function onClearHistory() {
    clearHistory();
    setHistory([]);
  }

  if (!open) return null;

  const showLoading = searchLoading && rows.length === 0 && input.trim().length >= 2;
  const showEmpty = !showLoading && rows.length === 0 && input.trim().length >= 2;
  const showHistoryAndTrending = input.trim().length === 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh] lg:pt-[8vh]">
      {/* backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      {/* modal */}
      <div className="relative w-full max-w-2xl mx-2 sm:mx-4 max-h-[80vh] flex flex-col rounded-xl border border-border/40 bg-popover shadow-2xl overflow-hidden">
        {/* header · 输入框 + 粘贴 + 关闭 */}
        <div className="flex items-center gap-2 p-3 border-b border-border/40">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value.slice(0, 80));
              setActiveIdx(0);
            }}
            placeholder={t('inputPlaceholder')}
            maxLength={80}
            className="flex-1 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={onPaste}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label={t('paste')}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>{t('paste')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* paste toast */}
        {pasteToast && (
          <div className="px-3 py-1 text-[11px] text-center text-muted-foreground bg-muted/30 border-b border-border/30">
            {pasteToast}
          </div>
        )}

        {/* tabs */}
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-border/40">
          <TabButton active={tab === 'tokens'} onClick={() => setTab('tokens')}>
            {t('tabs.tokens')}
          </TabButton>
          <TabButton active={tab === 'dapps'} onClick={() => setTab('dapps')}>
            {t('tabs.dapps')}
          </TabButton>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'dapps' ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t('comingSoon')}
            </div>
          ) : (
            <>
              {/* 历史 + trending 标题(空输入时) */}
              {showHistoryAndTrending && history.length > 0 && (
                <div className="p-3 border-b border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                      {t('history')}
                    </span>
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {t('historyClear')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {history.map((h) => (
                      <button
                        key={h.mint}
                        type="button"
                        onClick={() => handleNavigate(h)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-border/40 bg-muted/30 hover:bg-muted/60 text-xs text-foreground transition-colors"
                      >
                        {h.logo ? (
                          <Image
                            src={h.logo}
                            alt={h.symbol}
                            width={14}
                            height={14}
                            className="rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full bg-muted/60" />
                        )}
                        <span>{safeText(h.symbol, 12)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* trending 标题 */}
              {showHistoryAndTrending && (
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {t('trending')}
                  </span>
                </div>
              )}

              {/* 表头 */}
              <div className="hidden sm:grid grid-cols-[28px_1fr_90px_90px_90px_90px] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 border-b border-border/30">
                <div>{t('table.rank')}</div>
                <div>{t('table.name')}</div>
                <div className="text-right">{t('table.price')}</div>
                <div className="text-right">{t('table.liquidity')}</div>
                <div className="text-right">{t('table.vol1h')}</div>
                <div className="text-right">{t('table.marketCap')}</div>
              </div>

              {/* 行 */}
              {showLoading || trendingLoading ? (
                <div className="py-10 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('loading')}
                </div>
              ) : showEmpty ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  {t('empty')}
                </div>
              ) : (
                <div>
                  {rows.map((r, i) => (
                    <Row
                      key={r.mint}
                      r={r}
                      i={i}
                      active={i === activeIdx}
                      onSelect={() =>
                        handleNavigate({ mint: r.mint, symbol: r.symbol, logo: r.logo })
                      }
                      onHover={() => setActiveIdx(i)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
        active
          ? 'text-primary border-primary'
          : 'text-muted-foreground border-transparent hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Row({
  r,
  i,
  active,
  onSelect,
  onHover,
}: {
  r: RowItem;
  i: number;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={[
        'w-full grid grid-cols-[1fr_90px] sm:grid-cols-[28px_1fr_90px_90px_90px_90px] gap-2 px-3 py-2 text-left text-xs hover:bg-muted/30 transition-colors',
        active ? 'bg-muted/40' : '',
      ].join(' ')}
    >
      <span className="hidden sm:block text-muted-foreground/60 font-mono tabular-nums self-center">
        {i + 1}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
          {r.logo ? (
            <Image
              src={r.logo}
              alt={r.symbol}
              width={28}
              height={28}
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="text-[9px] font-bold text-muted-foreground">
              {r.symbol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">
              {safeText(r.symbol, 24)}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:inline whitespace-nowrap">
              {r.mint.slice(0, 4)}…{r.mint.slice(-4)}
            </span>
          </div>
          {r.name && r.name !== r.symbol && (
            <div className="text-[10px] text-muted-foreground truncate">
              {safeText(r.name, 30)}
            </div>
          )}
        </div>
      </div>
      <div className="text-right font-mono tabular-nums self-center">
        <div className="text-foreground">${formatPrice(r.priceUsd)}</div>
        {r.priceChange24h != null && (
          <div
            className={[
              'text-[10px]',
              r.priceChange24h > 0
                ? 'text-success'
                : r.priceChange24h < 0
                  ? 'text-danger'
                  : 'text-muted-foreground',
            ].join(' ')}
          >
            {r.priceChange24h > 0 ? '+' : ''}
            {r.priceChange24h.toFixed(2)}%
          </div>
        )}
      </div>
      <div className="hidden sm:block text-right font-mono tabular-nums text-muted-foreground self-center">
        {formatCompactUsd(r.liquidityUsd)}
      </div>
      <div className="hidden sm:block text-right font-mono tabular-nums text-muted-foreground self-center">
        {formatCompactUsd(r.volumeH24)}
      </div>
      <div className="hidden sm:block text-right font-mono tabular-nums text-muted-foreground self-center">
        {formatCompactUsd(r.marketCapUsd)}
      </div>
    </button>
  );
}

// 防御:剥离控制字符 + 截断,防外部 API 注入超长 / 隐形字符
// 不用 regex(避免源文件含 NUL/控制字节),直接 codePoint 过滤
function safeText(s: string, max = 64): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || c === 127) continue;
    out += ch;
    if (out.length >= max) break;
  }
  return out;
}

function formatPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.0001) return n.toFixed(6);
  const fixed = n.toFixed(20);
  const m = fixed.match(/^0\.(0+)(\d+)/);
  if (!m) return n.toPrecision(3);
  const lead = m[1].length;
  if (lead < 4) return `0.${m[1]}${m[2].slice(0, 4)}`;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return `0.0${String(lead).split('').map((d) => subs[+d]).join('')}${m[2].slice(0, 4)}`;
}

function formatCompactUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
