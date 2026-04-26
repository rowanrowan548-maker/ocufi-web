'use client';

/**
 * Landing 页 · 市场速览 · 币安风紧凑卡 + gmgn 信息密度
 *
 * 4 张卡片(热门 / Meme / LST / 稳定币)
 * 每行:[icon] [symbol] [price] [change%]
 *      [↳ 24h Vol: $X · MC: $Y]  ← gmgn 风第二行迷你信息
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  TrendingUp, TrendingDown, Flame, Sparkles, BarChart3, ArrowRight,
} from 'lucide-react';
import { fetchTokensInfoBatch, type TokenInfo } from '@/lib/portfolio';
import { PRESET_MAJORS, PRESET_MEME, PRESET_STABLE } from '@/lib/preset-tokens';
import { useTranslations } from 'next-intl';

const ALL = Array.from(new Set([...PRESET_MAJORS, ...PRESET_MEME, ...PRESET_STABLE]));

export function MarketSnapshot() {
  const t = useTranslations('landing.market');
  const [infos, setInfos] = useState<Map<string, TokenInfo>>(new Map());

  useEffect(() => {
    fetchTokensInfoBatch(ALL).then(setInfos).catch(() => {});
  }, []);

  // 选 token + 过滤 logo 缺失 + 按 24h 成交量排序,取前 5
  const pick = (mints: string[]): TokenInfo[] => {
    const list = mints
      .map((m) => infos.get(m))
      .filter((t): t is TokenInfo => !!t && !!t.logoUri);
    list.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
    return list.slice(0, 5);
  };

  // "热门" 卡:跨所有池子按 24h 成交量取 Top 5
  const hot = (() => {
    const all = Array.from(infos.values()).filter((t) => !!t.logoUri);
    all.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
    return all.slice(0, 5);
  })();

  return (
    <section className="px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-4 sm:mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-heading">
              {t('title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <SnapCard Icon={Flame} label={t('hot')} tokens={hot} more="/trade" />
          <SnapCard Icon={Sparkles} label={t('meme')} tokens={pick(PRESET_MEME)} more="/trade" />
          <SnapCard Icon={BarChart3} label={t('majors')} tokens={pick(PRESET_MAJORS)} more="/trade" />
        </div>
      </div>
    </section>
  );
}

function SnapCard({
  Icon, label, tokens, more,
}: {
  Icon: typeof Flame;
  label: string;
  tokens: TokenInfo[];
  more: string;
}) {
  const t = useTranslations('landing.market');
  return (
    <div className="group rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors overflow-hidden">
      {/* 头 · 币安风:icon + label 左 / 更多 → 右 */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <Link
          href={more}
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <span>{t('more')}</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* token 列 · 紧凑行(38px) */}
      <div className="divide-y divide-border/20">
        {tokens.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 h-[38px]">
                <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                <div className="h-3 w-12 bg-muted animate-pulse rounded ml-auto" />
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              </div>
            ))
          : tokens.map((tok) => <Row key={tok.mint} tok={tok} />)}
      </div>
    </div>
  );
}

function Row({ tok }: { tok: TokenInfo }) {
  const change = tok.priceChange24h;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  const ChangeIcon = up ? TrendingUp : down ? TrendingDown : null;
  const color = up ? 'text-success' : down ? 'text-danger' : 'text-muted-foreground';

  return (
    <Link
      href={`/trade?mint=${tok.mint}`}
      className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
    >
      <div className="h-5 w-5 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
        {tok.logoUri ? (
          <Image
            src={tok.logoUri}
            alt={tok.symbol}
            width={20}
            height={20}
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="text-[8px] font-bold text-muted-foreground">
            {tok.symbol.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-xs font-medium truncate">{tok.symbol}</span>
      <span className="text-xs font-mono text-foreground whitespace-nowrap">
        ${formatPrice(tok.priceUsd)}
      </span>
      <span
        className={`text-xs font-mono flex items-center gap-0.5 justify-end min-w-[58px] ${color}`}
      >
        {ChangeIcon && <ChangeIcon className="h-2.5 w-2.5" />}
        {change != null ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </span>
    </Link>
  );
}

function formatPrice(n: number): string {
  if (!n) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  // 压缩零格式
  const fixed = n.toFixed(20);
  const m = fixed.match(/^0\.(0+)(\d+)/);
  if (!m) return n.toPrecision(3);
  const lead = m[1].length;
  if (lead < 4) return `0.${m[1]}${m[2].slice(0, 4)}`;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return `0.0${String(lead).split('').map((d) => subs[+d]).join('')}${m[2].slice(0, 4)}`;
}
