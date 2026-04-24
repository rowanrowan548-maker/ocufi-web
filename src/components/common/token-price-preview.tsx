'use client';

/**
 * 通用代币价格预览
 *
 * 输入 mint 字符串 → debounce 查 DexScreener → 两行显示:
 *   第一行:图标 + symbol/name · 当前价(USD) + 24h 涨跌 · 查安全链接
 *   第二行:市值(MC) · 流动性(Liq) · 24h 成交量(Vol)
 *
 * 小数价格用压缩零格式(0.0₄8575 = 0.00008575)方便一眼读出量级
 */
import { useEffect, useRef, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { fetchTokenInfo, type TokenInfo } from '@/lib/portfolio';
import { useTranslations } from 'next-intl';

interface Props {
  mint: string;
  debounceMs?: number;
  showSafetyLink?: boolean;
}

function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

export function TokenPricePreview({ mint, debounceMs = 400, showSafetyLink = true }: Props) {
  const t = useTranslations();
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const m = mint.trim();
    setInfo(null);
    setNotFound(false);
    if (!isValidMint(m)) {
      setLoading(false);
      return;
    }

    const myReqId = ++reqIdRef.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const i = await fetchTokenInfo(m);
        if (reqIdRef.current !== myReqId) return;
        if (i) { setInfo(i); setNotFound(false); }
        else { setInfo(null); setNotFound(true); }
      } catch {
        if (reqIdRef.current !== myReqId) return;
        setInfo(null); setNotFound(true);
      } finally {
        if (reqIdRef.current === myReqId) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [mint, debounceMs]);

  if (!isValidMint(mint.trim())) return null;

  if (loading && !info) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        {t('token.notFound')}
      </div>
    );
  }
  if (!info) return null;

  const change = info.priceChange24h;
  const changePositive = change != null && change > 0;
  const changeNegative = change != null && change < 0;
  const changeColor = changePositive
    ? 'text-green-600 dark:text-green-400'
    : changeNegative
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';
  const ChangeIcon = changePositive ? TrendingUp : changeNegative ? TrendingDown : null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-3">
        {/* 图标 */}
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {info.logoUri ? (
            <Image
              src={info.logoUri}
              alt={info.symbol}
              width={36}
              height={36}
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="text-[11px] font-bold text-muted-foreground">
              {info.symbol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* symbol + name */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{info.symbol}</div>
          {info.name && info.name !== info.symbol && (
            <div className="text-xs text-muted-foreground truncate">{info.name}</div>
          )}
        </div>

        {/* 价格 + 涨跌 */}
        <div className="text-right flex-shrink-0">
          <div className="text-base font-mono font-semibold leading-tight">
            ${formatUsd(info.priceUsd)}
          </div>
          <div className={`text-xs font-mono flex items-center gap-0.5 justify-end ${changeColor}`}>
            {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
            {change != null ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
          </div>
        </div>

        {/* 安全链接 */}
        {showSafetyLink && (
          <Link
            href={`/token/${mint.trim()}`}
            className="flex-shrink-0 inline-flex items-center p-1 text-muted-foreground hover:text-foreground"
            title={t('trade.viewSafety')}
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* 第二行:MC / Liq / Vol */}
      <div className="flex gap-4 text-xs text-muted-foreground border-t pt-2">
        <span>
          <span className="mr-1">MC</span>
          <span className="font-mono text-foreground">${formatCompact(info.marketCap)}</span>
        </span>
        <span>
          <span className="mr-1">Liq</span>
          <span className="font-mono text-foreground">${formatCompact(info.liquidityUsd)}</span>
        </span>
        {info.volume24h != null && info.volume24h > 0 && (
          <span>
            <span className="mr-1">Vol 24h</span>
            <span className="font-mono text-foreground">${formatCompact(info.volume24h)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** USD 价格:大额常规小数,meme 币小价用压缩零格式(0.0₄8575) */
function formatUsd(n: number): string {
  if (!n || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.001) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  // 3 个以上前导零 → 压缩
  const fixed = n.toFixed(20);
  const match = fixed.match(/^0\.(0+)(\d+)/);
  if (!match) return n.toPrecision(4);
  const leadZeros = match[1].length;
  const rest = match[2].replace(/0+$/, '').slice(0, 4);
  if (leadZeros < 4) return `0.${match[1]}${rest}`;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  const sub = String(leadZeros).split('').map((d) => subs[Number(d)]).join('');
  return `0.0${sub}${rest}`;
}

/** 大额金额:$24.5B / $8.2M / $345K */
function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}
