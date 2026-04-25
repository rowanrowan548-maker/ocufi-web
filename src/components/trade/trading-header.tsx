'use client';

/**
 * 交易页紧凑代币信息条
 * 不显示 stats(交给右侧 InfoPanel),只展示:
 *   icon + symbol/name/mint + 价格±% + RiskBadge
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Copy, Check, TrendingUp, TrendingDown, ExternalLink, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchTokenDetail, overallRisk, type TokenDetail } from '@/lib/token-info';
import { RiskBadge } from '@/components/token/risk-badge';
import { useTranslations } from 'next-intl';
import { getCurrentChain } from '@/config/chains';
import { useFavorites } from '@/lib/favorites';

interface Props {
  mint: string;
  /** 父组件已经 fetch 过的 detail(避免重复请求) */
  detail?: TokenDetail | null;
}

export function TradingHeader({ mint, detail: detailProp }: Props) {
  const t = useTranslations();
  const chain = getCurrentChain();
  const [detail, setDetail] = useState<TokenDetail | null>(detailProp ?? null);
  const [loading, setLoading] = useState(!detailProp);
  const [copied, setCopied] = useState(false);
  const { isFavorite, toggle } = useFavorites();
  const starred = isFavorite(mint);

  useEffect(() => {
    if (detailProp !== undefined) {
      setDetail(detailProp);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    fetchTokenDetail(mint)
      .then((d) => { if (!cancelled) setDetail(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mint, detailProp]);

  async function copyMint() {
    try {
      await navigator.clipboard.writeText(mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* */ }
  }

  if (loading || !detail) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-28 bg-muted animate-pulse rounded" />
            <div className="h-3 w-40 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </Card>
    );
  }

  const risk = overallRisk(detail);
  const change = detail.priceChange24h;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  const ChangeIcon = up ? TrendingUp : down ? TrendingDown : null;
  const changeColor = up ? 'text-success' : down ? 'text-danger' : 'text-muted-foreground';

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* 左:icon + symbol/name/mint */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-1 ring-border/40">
            {detail.logoUri ? (
              <Image
                src={detail.logoUri}
                alt={detail.symbol}
                width={48}
                height={48}
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-base font-bold text-muted-foreground">
                {detail.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-bold tracking-tight">{detail.symbol}</span>
              <button
                type="button"
                onClick={() => toggle(mint)}
                aria-label={starred ? 'Remove favorite' : 'Add favorite'}
                className="p-1 hover:bg-muted/40 rounded transition-colors"
              >
                <Star
                  className={`h-4 w-4 ${
                    starred ? 'fill-warning text-warning' : 'text-muted-foreground/50'
                  }`}
                />
              </button>
              <RiskBadge level={risk} label={t(`token.risk.${risk}`)} />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              {detail.name && detail.name !== detail.symbol && (
                <span className="truncate max-w-[180px]">{detail.name}</span>
              )}
              <span className="font-mono">{shortAddr(mint)}</span>
              <button
                onClick={copyMint}
                className="hover:text-foreground"
                title={t('wallet.copyAddress')}
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              </button>
              <a
                href={`${chain.explorer}/token/${mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* 中:价格 + 涨跌 · 大字 */}
        <div className="flex items-baseline gap-2 sm:ml-auto sm:border-l sm:border-border/60 sm:pl-5">
          <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight">
            ${formatPrice(detail.priceUsd)}
          </span>
          {change != null && (
            <span className={`text-sm font-mono font-medium flex items-center gap-0.5 ${changeColor}`}>
              {ChangeIcon && <ChangeIcon className="h-4 w-4" />}
              {up ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function shortAddr(s: string): string {
  return s.slice(0, 4) + '…' + s.slice(-4);
}

function formatPrice(n: number): string {
  if (!n) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  const fixed = n.toFixed(20);
  const m = fixed.match(/^0\.(0+)(\d+)/);
  if (!m) return n.toPrecision(3);
  const lead = m[1].length;
  if (lead < 4) return `0.${m[1]}${m[2].slice(0, 4)}`;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return `0.0${String(lead).split('').map((d) => subs[+d]).join('')}${m[2].slice(0, 4)}`;
}
