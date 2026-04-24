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
  TrendingUp, TrendingDown, Flame, Sparkles, BarChart3, Rocket, ArrowRight,
} from 'lucide-react';
import { fetchTokensInfoBatch, type TokenInfo } from '@/lib/portfolio';
import { useTranslations } from 'next-intl';

const HOT_MINTS = [
  'So11111111111111111111111111111111111111112',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
];
const MEME_MINTS = [
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
];
const LST_MINTS = [
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  '7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn',
  'BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85',
];
const VOL_MINTS = [
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
];

const ALL = Array.from(new Set([...HOT_MINTS, ...MEME_MINTS, ...LST_MINTS, ...VOL_MINTS]));

export function MarketSnapshot() {
  const t = useTranslations('landing.market');
  const [infos, setInfos] = useState<Map<string, TokenInfo>>(new Map());

  useEffect(() => {
    fetchTokensInfoBatch(ALL).then(setInfos).catch(() => {});
  }, []);

  const pick = (mints: string[]) => mints.map((m) => infos.get(m)).filter(Boolean) as TokenInfo[];

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SnapCard Icon={Flame} label={t('hot')} tokens={pick(HOT_MINTS)} more="/trade" />
          <SnapCard Icon={Sparkles} label={t('meme')} tokens={pick(MEME_MINTS)} more="/trade" />
          <SnapCard Icon={Rocket} label={t('lst')} tokens={pick(LST_MINTS)} more="/trade" />
          <SnapCard Icon={BarChart3} label={t('stables')} tokens={pick(VOL_MINTS)} more="/trade" />
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
      href={`/token/${tok.mint}`}
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
