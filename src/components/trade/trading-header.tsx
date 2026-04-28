'use client';

/**
 * 交易页 Hero
 *
 * 桌面 lg+(T-501 三层布局,完全保留):
 *   层 1 · 细条:小头像 / SYMBOL · NAME · mint短 / 复制 / Solscan
 *   层 2 · 主信息:大头像 / SYMBOL + ✅验证 + 中文名 / 价格 / 24h%
 *   层 3 · 数据条:市值 · 流动性 · 24h 量 · 持币 · 风险 · 年龄
 *
 * 移动 < lg(T-505c OKX 风格):
 *   顶部一行:< [头像] SYMBOL ▼ ✅ mint短 复制 ⭐
 *            ▼ 触发 TokenSearchCombo popover(切币)
 *   下方:左大字价格 + 涨跌 / 右 6 项 vertical 数据
 *   独立 TokenSearchCombo 在移动端被 trade-screen 隐藏
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Star,
  BadgeCheck,
  ChevronLeft,
  ChevronDown,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchTokenDetail, overallRisk, type TokenDetail } from '@/lib/token-info';
import { RiskBadge } from '@/components/token/risk-badge';
import { TokenSearchCombo } from '@/components/common/token-search-combo';
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
  /** 移动端 ▼ 切币回调(桌面端不会触发) */
  onSelectMint?: (mint: string) => void;
}

export function TradingHeader({ mint, detail: detailProp, onSelectMint }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const chain = getCurrentChain();
  const [detail, setDetail] = useState<TokenDetail | null>(detailProp ?? null);
  const [loading, setLoading] = useState(!detailProp);
  const [copied, setCopied] = useState(false);
  const [copiedMobile, setCopiedMobile] = useState(false);
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

  async function copyMint(setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(mint);
      setter(true);
      setTimeout(() => setter(false), 1500);
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
  // BUG-022:DexScreener 偶发返回 NaN/Infinity(分母为 0),Number.isFinite 守卫,非数显示 —
  const rawChange = detail.priceChange24h;
  const change = rawChange != null && Number.isFinite(rawChange) ? rawChange : null;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  const ChangeIcon = up ? TrendingUp : down ? TrendingDown : null;
  const changeColor = up
    ? 'text-success'
    : down
    ? 'text-destructive'
    : 'text-muted-foreground';

  return (
    <>
      {/* ───── T-OKX-2 桌面 lg+ · 1 行紧凑 OKX 风(原 2 层合并 · 删 1 头像 + 1 mint copy 重复) ───── */}
      <Card className="hidden lg:block px-3 py-2">
        <div className="flex items-center gap-4 xl:gap-6">
          {/* 左 cluster:logo + symbol + verified + star + age + mint + copy + solscan */}
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            <div className="h-9 w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-1 ring-border/40">
              {detail.logoUri ? (
                <Image src={detail.logoUri} alt={detail.symbol} width={36} height={36} className="object-cover" unoptimized />
              ) : (
                <span className="text-xs font-bold text-muted-foreground">
                  {detail.symbol.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="font-mono uppercase text-base font-bold tracking-tight">
              {detail.symbol}
            </span>
            {verified && (
              <BadgeCheck className="h-4 w-4 text-success flex-shrink-0" aria-label={t('trade.header.verified')} />
            )}
            <button
              type="button"
              onClick={() => toggle(mint)}
              aria-label={starred ? 'Remove favorite' : 'Add favorite'}
              className="p-0.5 hover:bg-muted/40 rounded transition-colors flex-shrink-0"
            >
              <Star className={`h-3.5 w-3.5 ${starred ? 'fill-warning text-warning' : 'text-muted-foreground/50'}`} />
            </button>
            {detail.name && detail.name !== detail.symbol && (
              <span className="text-[11px] text-muted-foreground/70 truncate max-w-[120px] xl:max-w-[180px]">
                {detail.name}
              </span>
            )}
            <span className="text-muted-foreground/40 text-[10px]">·</span>
            <span className="text-[10px] text-muted-foreground/70">{formatAge(detail.createdAt, t)}</span>
            <span className="text-muted-foreground/40 text-[10px]">·</span>
            <span className="font-mono text-[10px] text-muted-foreground/70">{shortAddr(mint)}</span>
            <button
              type="button"
              onClick={() => copyMint(setCopied)}
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
              title={t('wallet.copyAddress')}
              aria-label={t('wallet.copyAddress')}
            >
              {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            </button>
            <a
              href={`${chain.explorer}/token/${mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label="Solscan"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* 中:大价格 + 24h% */}
          <div className="flex flex-col gap-0 flex-shrink-0">
            <span className="text-2xl xl:text-3xl font-bold font-mono tracking-tight leading-none tabular-nums">
              ${formatPrice(detail.priceUsd)}
            </span>
            {change != null && (
              <span className={`text-xs font-mono font-medium flex items-center gap-0.5 mt-0.5 ${changeColor}`}>
                {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
                {up ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>

          {/* 右 BarStat row · OKX 字段顺序:流动性 / 持币地址 / 总手续费 / 总买卖税 / 风险 */}
          <div className="flex items-center gap-5 xl:gap-8 flex-1 overflow-x-auto justify-end">
            <BarStat label={t('trade.header.dataLabels.liquidity')} value={formatUsdCompact(detail.liquidityUsd)} />
            <BarStat label={t('trade.header.dataLabels.holders')} value={formatCompact(detail.totalHolders ?? null)} />
            <BarStat label={t('trade.header.dataLabels.fee')} value="0.1%" />
            <BarStat label={t('trade.header.dataLabels.tax')} value="0%" />
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                {t('trade.header.dataLabels.risk')}
              </span>
              <RiskBadge level={risk} label={t(`token.risk.${risk}`)} />
            </div>
          </div>
        </div>
      </Card>

      {/* ───── 移动 < lg · OKX 一屏密度(T-977b 压扁) ─────
          删 6 数字 data 条(数据已搬到右栏 MobileDataColumn)
          压缩 padding + 缩 price 字号 + 移除 Card border/shadow */}
      <div className="lg:hidden px-2 py-1.5">
        {/* 顶部一行:back + 头像 + SYMBOL ▼(切币) + 验证 + mint + 复制 + ⭐ */}
        <TokenSearchCombo
          value={mint}
          onSelect={(m) => onSelectMint?.(m)}
          renderTrigger={({ open, toggle: openSwitcher }) => (
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
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
              <button
                type="button"
                onClick={openSwitcher}
                className="flex items-center gap-0.5 font-bold text-base font-mono uppercase tracking-tight hover:text-primary transition-colors min-w-0"
              >
                <span className="truncate">{detail.symbol}</span>
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 transition-transform ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {verified && (
                <BadgeCheck
                  className="h-4 w-4 text-success flex-shrink-0"
                  aria-label={t('trade.header.verified')}
                />
              )}
              <span className="font-mono text-[10px] text-muted-foreground/70 truncate">
                {shortAddr(mint)}
              </span>
              <button
                type="button"
                onClick={() => copyMint(setCopiedMobile)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 flex-shrink-0"
                title={t('wallet.copyAddress')}
                aria-label={t('wallet.copyAddress')}
              >
                {copiedMobile ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => toggle(mint)}
                aria-label={starred ? 'Remove favorite' : 'Add favorite'}
                className="p-1 hover:bg-muted/40 rounded transition-colors flex-shrink-0 ml-auto"
              >
                <Star
                  className={`h-4 w-4 ${
                    starred ? 'fill-warning text-warning' : 'text-muted-foreground/50'
                  }`}
                />
              </button>
            </div>
          )}
        />

        {/* T-977b · 价格行 inline 单行(text-2xl→text-lg / 缩 mt + 取消 border-t) */}
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-bold font-mono tracking-tight leading-none tabular-nums">
            ${formatPrice(detail.priceUsd)}
          </span>
          {change != null && (
            <span
              className={`text-xs font-mono font-medium flex items-center gap-0.5 tabular-nums ${changeColor}`}
            >
              {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
              {up ? '+' : ''}
              {change.toFixed(2)}%
            </span>
          )}
          {/* T-977b · 风险 badge inline 同行(数据条已删 · 风险移到价格行右侧) */}
          <div className="ml-auto">
            <RiskBadge level={risk} label={t(`token.risk.${risk}`)} />
          </div>
        </div>
        {/* T-977b · 删整块 6 数字 data 条(市值/流动性/24h/持币/年龄 已搬到右栏 MobileDataColumn) */}
      </div>
    </>
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

// T-984b · OKX 样横排单字段(label 小灰字 + 数字大字 · 紧凑 inline 间距)
function BarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 flex-shrink-0 whitespace-nowrap">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-foreground font-mono text-base font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

function shortAddr(s: string): string {
  return s.slice(0, 4) + '…' + s.slice(-4);
}
