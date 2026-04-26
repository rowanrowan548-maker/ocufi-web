'use client';

/**
 * 交易页 Hero 数据条 · 三层布局
 *
 *   层 1 · 细条:小头像 / SYMBOL · NAME · mint短 / 复制 / Solscan
 *   层 2 · 主信息:大头像 / SYMBOL + ✅验证 + 中文名 / 价格 / 24h%
 *   层 3 · 数据条:市值 · 流动性 · 24h 量 · 持币 · 风险 · 年龄
 *
 * 数据全部来自父组件传入的 TokenDetail(避免重复 fetch)。
 * 风险用 RiskBadge 组件,验证态用 isVerifiedToken 判断。
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Star,
  BadgeCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchTokenDetail, overallRisk, type TokenDetail } from '@/lib/token-info';
import { RiskBadge } from '@/components/token/risk-badge';
import { isVerifiedToken } from '@/lib/verified-tokens';
import { useTranslations } from 'next-intl';
import { getCurrentChain } from '@/config/chains';
import { useFavorites } from '@/lib/favorites';
import {
  formatPrice,
  formatCompact,
  formatUsdCompact,
  formatAge,
} from '@/lib/format';

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
      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 bg-muted animate-pulse rounded" />
            <div className="h-3 w-28 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </Card>
    );
  }

  const risk = overallRisk(detail);
  const verified = isVerifiedToken(mint);
  const change = detail.priceChange24h;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  const ChangeIcon = up ? TrendingUp : down ? TrendingDown : null;
  const changeColor = up
    ? 'text-success'
    : down
    ? 'text-destructive'
    : 'text-muted-foreground';

  return (
    <Card className="p-3 sm:p-4">
      {/* 层 1 · 细条:小头像 / mint / 复制 / 链浏览器 */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-1 ring-border/40">
          {detail.logoUri ? (
            <Image
              src={detail.logoUri}
              alt={detail.symbol}
              width={32}
              height={32}
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground">
              {detail.symbol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <span className="font-mono uppercase text-foreground/80 font-medium">{detail.symbol}</span>
        {detail.name && detail.name !== detail.symbol && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="truncate max-w-[180px] sm:max-w-[280px]">{detail.name}</span>
          </>
        )}
        <span className="text-muted-foreground/40">·</span>
        <span className="font-mono">{shortAddr(mint)}</span>
        <button
          type="button"
          onClick={copyMint}
          className="hover:text-foreground transition-colors"
          title={t('wallet.copyAddress')}
          aria-label={t('wallet.copyAddress')}
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
        <a
          href={`${chain.explorer}/token/${mint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors ml-auto"
          aria-label="Solscan"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* 层 2 · 主信息:大头像 / symbol+验证+name / 价格+涨跌 */}
      <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-3 sm:gap-4">
        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-1 ring-border/40">
          {detail.logoUri ? (
            <Image
              src={detail.logoUri}
              alt={detail.symbol}
              width={64}
              height={64}
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="text-lg font-bold text-muted-foreground">
              {detail.symbol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono uppercase text-xl sm:text-2xl font-bold tracking-tight">
              {detail.symbol}
            </span>
            {verified && (
              <span
                className="inline-flex items-center gap-0.5 text-success text-xs font-medium"
                title={t('trade.header.verified')}
              >
                <BadgeCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{t('trade.header.verified')}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => toggle(mint)}
              aria-label={starred ? 'Remove favorite' : 'Add favorite'}
              className="p-1 hover:bg-muted/40 rounded transition-colors ml-auto sm:ml-0"
            >
              <Star
                className={`h-4 w-4 ${
                  starred ? 'fill-warning text-warning' : 'text-muted-foreground/50'
                }`}
              />
            </button>
          </div>
          {detail.name && detail.name !== detail.symbol && (
            <div className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
              {detail.name}
            </div>
          )}
        </div>

        {/* 价格 + 涨跌 */}
        <div className="flex flex-col items-end justify-center gap-0.5 flex-shrink-0">
          <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight leading-none">
            ${formatPrice(detail.priceUsd)}
          </span>
          {change != null && (
            <span
              className={`text-xs sm:text-sm font-mono font-medium flex items-center gap-0.5 ${changeColor}`}
            >
              {ChangeIcon && <ChangeIcon className="h-3.5 w-3.5" />}
              {up ? '+' : ''}
              {change.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* 层 3 · 数据条:6 项数据 · mobile 3×2 / desktop 1×6 */}
      <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-6">
        <DataCell
          label={t('trade.header.dataLabels.marketCap')}
          value={formatUsdCompact(detail.marketCap)}
        />
        <DataCell
          label={t('trade.header.dataLabels.liquidity')}
          value={formatUsdCompact(detail.liquidityUsd)}
        />
        <DataCell
          label={t('trade.header.dataLabels.volume24h')}
          value={formatUsdCompact(detail.volume24h ?? null)}
        />
        <DataCell
          label={t('trade.header.dataLabels.holders')}
          value={formatCompact(detail.totalHolders ?? null)}
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
            {t('trade.header.dataLabels.risk')}
          </span>
          <div className="flex items-center">
            <RiskBadge level={risk} label={t(`token.risk.${risk}`)} />
          </div>
        </div>
        <DataCell
          label={t('trade.header.dataLabels.age')}
          value={formatAge(detail.createdAt, t)}
        />
      </div>
    </Card>
  );
}

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-foreground font-mono text-sm font-medium truncate">
        {value}
      </span>
    </div>
  );
}

function shortAddr(s: string): string {
  return s.slice(0, 4) + '…' + s.slice(-4);
}
