'use client';

/**
 * 交易页紧凑代币信息条(币安/gmgn 风)
 *
 * 一行/两行内显示:
 *   [icon] symbol  name  shortAddr [verified?] | $price ±% | MC | Liq | Vol | Age
 *
 * 不像 TokenDetailView 那样大 hero,信息密度高,横向排开
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Copy, Check, ShieldCheck, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  fetchTokenDetail, overallRisk, type TokenDetail,
} from '@/lib/token-info';
import { RiskBadge } from '@/components/token/risk-badge';
import { useTranslations } from 'next-intl';
import { getCurrentChain } from '@/config/chains';

interface Props {
  mint: string;
}

export function TradingHeader({ mint }: Props) {
  const t = useTranslations();
  const chain = getCurrentChain();
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    fetchTokenDetail(mint)
      .then((d) => { if (!cancelled) setDetail(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mint]);

  async function copyMint() {
    try {
      await navigator.clipboard.writeText(mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* */ }
  }

  if (loading || !detail) {
    return (
      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
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

  const ageText = formatAge(detail.createdAt, t);

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-5">
        {/* 左:icon + symbol/name/mint */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div className="h-11 w-11 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-1 ring-border/40">
            {detail.logoUri ? (
              <Image
                src={detail.logoUri}
                alt={detail.symbol}
                width={44}
                height={44}
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">
                {detail.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-bold tracking-tight">{detail.symbol}</span>
              {detail.name && detail.name !== detail.symbol && (
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {detail.name}
                </span>
              )}
              {risk === 'verified' && (
                <ShieldCheck className="h-3.5 w-3.5 text-info" />
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="font-mono">{shortAddr(mint)}</span>
              <button onClick={copyMint} className="p-0.5 hover:text-foreground">
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              </button>
              <a
                href={`${chain.explorer}/token/${mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* 中:价格 + 涨跌 */}
        <div className="flex items-baseline gap-2 lg:border-l lg:border-border/60 lg:pl-5 flex-shrink-0">
          <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight">
            ${formatPrice(detail.priceUsd)}
          </span>
          {change != null && (
            <span className={`text-sm font-mono font-medium flex items-center gap-0.5 ${changeColor}`}>
              {ChangeIcon && <ChangeIcon className="h-3.5 w-3.5" />}
              {up ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
        </div>

        {/* 右:统计指标网格(币安风) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-2 flex-1 lg:border-l lg:border-border/60 lg:pl-5 text-xs">
          <Stat label={t('token.marketCap')} value={`$${formatCompact(detail.marketCap)}`} />
          <Stat
            label={t('token.liquidity')}
            value={`$${formatCompact(detail.liquidityUsd)}`}
            warn={detail.liquidityUsd > 0 && detail.liquidityUsd < 50_000}
          />
          <Stat label={t('token.volume24h')} value={`$${formatCompact(detail.volume24h ?? 0)}`} />
          <Stat label={t('token.createdAt')} value={ageText} warn={ageText.includes('h') || ageText === t('token.age.minutes_full', { default: '< 1h' })} />
        </div>

        {/* 远右:Risk badge */}
        <div className="flex-shrink-0 lg:self-start">
          <RiskBadge level={risk} label={t(`token.risk.${risk}`)} className="text-xs" />
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span
        className={`font-mono ${warn ? 'text-warning' : 'text-foreground'} tracking-tight`}
      >
        {value}
      </span>
    </div>
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

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

function formatAge(createdAt: number | undefined, t: ReturnType<typeof useTranslations>): string {
  if (!createdAt) return '—';
  const hours = (Date.now() - createdAt) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.floor(hours * 60)}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  if (hours < 24 * 30) return `${Math.floor(hours / 24)}d`;
  if (hours < 24 * 365) return `${Math.floor(hours / 24 / 30)}mo`;
  return `${Math.floor(hours / 24 / 365)}y`;
}
