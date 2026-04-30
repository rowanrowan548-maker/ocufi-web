'use client';

/**
 * T-FE-MOBILE-RESCUE-P0 · /markets 移动端卡片视图(< md 显示)
 *
 * 桌面 ≥ md 仍走 markets-table.tsx 表格 · 这里是 hidden md:hidden 的双轨副本
 *
 * 卡片结构:
 *   ┌────────────────────────────────────────┐
 *   │ [logo] symbol  ⓘname           [smart] │  ← 顶
 *   │ $price                          [risk] │  ← 中(数字大 · 触控友好)
 *   │ 5m  +1.2%   1h  +3.4%   24h  +5.6%     │  ← 涨跌一行 chip
 *   │ 流动性 $X.XK · 持币 N · 池龄 1d         │  ← 元数据(text-[11px])
 *   │ [⚡ 快买]                               │  ← 全宽按钮(触控 ≥ 44px)
 *   └────────────────────────────────────────┘
 *
 * 设计原则(Sprint 2 救火 · 不重设计):
 *   - 不横滚 · 一目了然
 *   - 触控热区全部 ≥ 44×44(iOS HIG)
 *   - SmartMoney + Risk badges 卡角不挤数字
 *   - 复用 markets-table 的 SmartMoneyBadge / RiskBadge / formatPrice/Compact/Age
 */
import Link from 'next/link';
import Image from 'next/image';
import type { MarketItem } from '@/lib/api-client';
import { SmartMoneyBadge } from './smart-money-badge';
import { Zap } from 'lucide-react';

interface Props {
  items: MarketItem[];
  showRisk?: boolean;
  RiskBadge?: React.ComponentType<{ mint: string }>;
}

export function MarketsCardsMobile({ items, showRisk, RiskBadge }: Props) {
  return (
    <div className="md:hidden divide-y divide-border/40" data-testid="markets-cards-mobile">
      {items.map((it) => (
        <MarketCard
          key={it.mint}
          it={it}
          showRisk={showRisk}
          RiskBadge={RiskBadge}
        />
      ))}
    </div>
  );
}

function MarketCard({
  it, showRisk, RiskBadge,
}: {
  it: MarketItem;
  showRisk?: boolean;
  RiskBadge?: React.ComponentType<{ mint: string }>;
}) {
  return (
    <article
      data-testid="markets-card-mobile"
      data-mint={it.mint}
      className="px-3 py-3 hover:bg-muted/30 transition-colors"
    >
      {/* 顶 · token 信息 + smart money + risk */}
      <div className="flex items-start gap-2.5">
        <Link
          href={`/trade?mint=${it.mint}`}
          className="flex items-center gap-2.5 min-w-0 flex-1"
          aria-label={`Trade ${it.symbol}`}
        >
          <div className="h-9 w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {it.logo ? (
              <Image src={it.logo} alt={it.symbol} width={36} height={36} className="object-cover" unoptimized />
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground">
                {it.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{it.symbol}</div>
            {it.name && it.name !== it.symbol && (
              <div className="text-[11px] text-muted-foreground truncate">{it.name}</div>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-2 flex-shrink-0">
          <SmartMoneyBadge mint={it.mint} />
          {showRisk && RiskBadge && <RiskBadge mint={it.mint} />}
        </div>
      </div>

      {/* 中 · 大字价格 */}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="font-mono text-base font-semibold">
          {it.priceUsd != null ? `$${formatPrice(it.priceUsd)}` : '—'}
        </div>
        <ChangeRow change5m={it.change5m} change1h={it.change1h} change24h={it.change24h} />
      </div>

      {/* 元数据 · 紧凑一行 */}
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground font-mono whitespace-nowrap overflow-hidden">
        <Stat label="Liq" value={it.liquidityUsd != null ? `$${formatCompact(it.liquidityUsd)}` : '—'} />
        <Stat label="MCap" value={it.marketCapUsd != null ? `$${formatCompact(it.marketCapUsd)}` : '—'} />
        <Stat label="Vol24" value={it.volumeH24 != null ? `$${formatCompact(it.volumeH24)}` : '—'} />
        <Stat label="Age" value={formatAge(it.ageHours)} />
      </div>

      {/* 底 · 全宽快买 · 触控 ≥ 44px */}
      <Link
        href={`/trade?mint=${it.mint}`}
        data-testid="markets-card-quickbuy"
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 h-11 rounded-md bg-[var(--brand-up)]/15 text-[var(--brand-up)] text-sm font-medium hover:bg-[var(--brand-up)]/25 active:bg-[var(--brand-up)]/30 transition-colors"
      >
        <Zap className="h-4 w-4" />
        <span>{it.symbol}</span>
      </Link>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground/60">{label}</span>
      <span className="text-foreground/80">{value}</span>
    </span>
  );
}

function ChangeRow({
  change5m, change1h, change24h,
}: {
  change5m: number | null;
  change1h: number | null;
  change24h: number | null;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono whitespace-nowrap">
      <ChangePill label="5m" pct={change5m} />
      <ChangePill label="1h" pct={change1h} />
      <ChangePill label="24h" pct={change24h} />
    </div>
  );
}

function ChangePill({ label, pct }: { label: string; pct: number | null }) {
  if (pct == null) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className="text-muted-foreground/60">{label}</span>
        <span className="text-muted-foreground/50">—</span>
      </span>
    );
  }
  const up = pct > 0;
  const cls = up ? 'text-[var(--brand-up)]' : pct < 0 ? 'text-[var(--brand-down)]' : 'text-muted-foreground';
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="text-muted-foreground/60">{label}</span>
      <span className={cls}>{up ? '+' : ''}{pct.toFixed(1)}%</span>
    </span>
  );
}

// 复用 markets-table 同款 formatter · 这里复制一份保持组件自包含 · 后续可抽 lib
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
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function formatAge(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  if (hours < 24 * 30) return `${(hours / 24).toFixed(0)}d`;
  return `${(hours / (24 * 30)).toFixed(0)}mo`;
}
