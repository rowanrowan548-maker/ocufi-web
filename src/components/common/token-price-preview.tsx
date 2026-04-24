'use client';

/**
 * 通用代币价格预览
 *
 * 输入 mint 字符串,自动(带 debounce)查 DexScreener 显示:
 *   图标 + symbol + 当前价 + 24h 涨跌 + 流动性
 *
 * 嵌在所有"输入 mint 地址"的场景(买 / 卖 / 限价 / 提醒)让用户在下单前
 * 就能看到币的基本面,不用跳到 /token 详情页
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
  /** debounce 毫秒,默认 400 */
  debounceMs?: number;
  /** 是否显示右侧"查安全"小链接,默认 true */
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
        if (reqIdRef.current !== myReqId) return; // 已被更新的输入覆盖
        if (i) {
          setInfo(i);
          setNotFound(false);
        } else {
          setInfo(null);
          setNotFound(true);
        }
      } catch {
        if (reqIdRef.current !== myReqId) return;
        setInfo(null);
        setNotFound(true);
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
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
      {/* 图标 */}
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
        {info.logoUri ? (
          <Image
            src={info.logoUri}
            alt={info.symbol}
            width={32}
            height={32}
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="text-[10px] font-bold text-muted-foreground">
            {info.symbol.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* symbol + name */}
      <div className="flex flex-col min-w-0 flex-shrink">
        <div className="text-sm font-medium truncate">{info.symbol}</div>
        <div className="text-xs text-muted-foreground truncate">
          Liq ${formatCompact(info.liquidityUsd)}
        </div>
      </div>

      {/* 当前价 + 24h 涨跌 */}
      <div className="ml-auto flex flex-col items-end">
        <div className="text-sm font-mono font-medium">
          ${formatPrice(info.priceUsd)}
        </div>
        <div className={`text-xs font-mono flex items-center gap-1 ${changeColor}`}>
          {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
          {change != null ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </div>
      </div>

      {/* 查安全 */}
      {showSafetyLink && (
        <Link
          href={`/token/${mint.trim()}`}
          className="flex-shrink-0 inline-flex items-center p-1 text-muted-foreground hover:text-foreground"
          title={t('trade.viewSafety')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function formatPrice(n: number): string {
  if (!n) return '—';
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}

function formatCompact(n: number): string {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}
