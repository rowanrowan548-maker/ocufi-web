'use client';

/**
 * 代币搜索下拉
 *
 * - 输入空时:显示所有常用代币(按市值降序)
 * - 输入 "wif" / "Solana" / mint 前缀:模糊匹配 symbol / name / mint
 * - 输入完整 mint(且不在常用列表):提供"使用此地址"项
 *
 * 选择某项 → onSelect(mint) → 父组件接管(改 state / 改 URL / 等)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Search, ChevronDown, Loader2 } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { Input } from '@/components/ui/input';
import { fetchTokenInfo, fetchTokensInfoBatch, searchTokens, type TokenInfo } from '@/lib/portfolio';
import { PRESET_ALL } from '@/lib/preset-tokens';
import { useTranslations } from 'next-intl';

interface Props {
  /** 当前选中的 mint(显示当前代币图标 + symbol) */
  value: string;
  onSelect: (mint: string) => void;
}

function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

export function TokenSearchCombo({ value, onSelect }: Props) {
  const t = useTranslations('trade.search');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [presets, setPresets] = useState<TokenInfo[]>([]);
  const [current, setCurrent] = useState<TokenInfo | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  // 远端搜索结果(DexScreener)
  const [remoteHits, setRemoteHits] = useState<TokenInfo[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 拉常用代币池
  useEffect(() => {
    fetchTokensInfoBatch(PRESET_ALL).then((map) => {
      const arr = Array.from(map.values()).sort(
        (a, b) => (b.marketCap || 0) - (a.marketCap || 0)
      );
      setPresets(arr);
    });
  }, []);

  // 当前选中代币元数据
  useEffect(() => {
    if (!isValidMint(value)) {
      setCurrent(null);
      return;
    }
    // 先看 presets 里有没有
    const inPreset = presets.find((p) => p.mint === value);
    if (inPreset) {
      setCurrent(inPreset);
      return;
    }
    // 没有就额外拉一次(用户搜的非常用代币)
    setExternalLoading(true);
    fetchTokenInfo(value)
      .then((info) => setCurrent(info))
      .catch(() => setCurrent(null))
      .finally(() => setExternalLoading(false));
  }, [value, presets]);

  // 点外面关下拉
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const localFiltered = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.mint.toLowerCase().startsWith(q)
    );
  }, [input, presets]);

  // 远端搜索 · 输入 >= 2 字符且不是完整 mint 时触发,防抖 350ms
  useEffect(() => {
    const q = input.trim();
    if (q.length < 2 || isValidMint(q)) {
      setRemoteHits([]);
      setRemoteLoading(false);
      return;
    }
    setRemoteLoading(true);
    const id = setTimeout(() => {
      searchTokens(q, 20)
        .then((hits) => setRemoteHits(hits))
        .catch(() => setRemoteHits([]))
        .finally(() => setRemoteLoading(false));
    }, 350);
    return () => clearTimeout(id);
  }, [input]);

  // 合并 local + remote,去重保留 local 优先
  const filtered = useMemo(() => {
    if (remoteHits.length === 0) return localFiltered;
    const seen = new Set(localFiltered.map((t) => t.mint));
    const remoteOnly = remoteHits.filter((t) => !seen.has(t.mint));
    return [...localFiltered, ...remoteOnly];
  }, [localFiltered, remoteHits]);

  const inputIsMint = isValidMint(input.trim());
  const showRawMintOption =
    inputIsMint && !filtered.some((t) => t.mint === input.trim());

  function handleSelect(mint: string) {
    onSelect(mint);
    setOpen(false);
    setInput('');
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* 触发器 · 显示当前代币 + 下拉箭头 */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2.5 hover:border-primary/40 transition-colors"
      >
        {current ? (
          <>
            <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
              {current.logoUri ? (
                <Image
                  src={current.logoUri}
                  alt={current.symbol}
                  width={28}
                  height={28}
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground">
                  {current.symbol.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-base font-bold tracking-tight text-foreground truncate">
                {current.symbol}
              </div>
              {current.name && current.name !== current.symbol && (
                <div className="text-xs text-muted-foreground truncate">
                  {current.name}
                </div>
              )}
            </div>
            <div className="text-sm font-mono text-foreground flex-shrink-0">
              ${formatPrice(current.priceUsd)}
            </div>
          </>
        ) : externalLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('loading')}</span>
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1 text-left">
              {t('placeholder')}
            </span>
          </>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border/60 bg-popover shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border/40">
            <div className="flex items-center gap-2 px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder={t('inputPlaceholder')}
                value={input}
                // 防御:截到 80 字符,挡超长输入打满搜索 API 配额
                onChange={(e) => setInput(e.target.value.slice(0, 80))}
                maxLength={80}
                className="border-0 focus-visible:ring-0 px-0 h-8 bg-transparent shadow-none"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* 自定义 mint 兜底 */}
            {showRawMintOption && (
              <button
                type="button"
                onClick={() => handleSelect(input.trim())}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left border-b border-border/40"
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Search className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t('useRaw')}</div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {input.trim()}
                  </div>
                </div>
              </button>
            )}

            {/* 候选列表 */}
            {filtered.length === 0 && !showRawMintOption ? (
              remoteLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('loading')}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {t('noResults')}
                </div>
              )
            ) : (
              filtered.map((tok) => (
                <button
                  key={tok.mint}
                  type="button"
                  onClick={() => handleSelect(tok.mint)}
                  className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors text-left ${
                    tok.mint === value ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {tok.logoUri ? (
                      <Image
                        src={tok.logoUri}
                        alt={tok.symbol}
                        width={24}
                        height={24}
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-[9px] font-bold text-muted-foreground">
                        {tok.symbol.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium truncate">
                        {safeText(tok.symbol, 24)}
                      </span>
                      {/* 同名币区分 · mint 首尾位 */}
                      <span className="text-[9px] font-mono text-muted-foreground/50 whitespace-nowrap">
                        {tok.mint.slice(0, 6)}…{tok.mint.slice(-4)}
                      </span>
                    </div>
                    {tok.name && tok.name !== tok.symbol && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {safeText(tok.name, 40)}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono">${formatPrice(tok.priceUsd)}</div>
                    {tok.priceChange24h != null && (
                      <div
                        className={`text-[10px] font-mono ${
                          tok.priceChange24h > 0
                            ? 'text-success'
                            : tok.priceChange24h < 0
                            ? 'text-danger'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {tok.priceChange24h > 0 ? '+' : ''}
                        {tok.priceChange24h.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 防御:剥离控制字符 + 截断,避免外部 API 注入超长 / 隐形字符 */
function safeText(s: string, max = 64): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function formatPrice(n: number): string {
  if (!n) return '—';
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
