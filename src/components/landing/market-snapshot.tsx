'use client';

/**
 * Landing 页 · 市场速览
 *
 * 4 张卡片(币安式布局):热门 / 新币 / 涨幅榜 / 成交榜
 * 数据源:DexScreener(预设一批 mint,不做排序 API — MVP 先填死范围,
 * V2 接后端 /market/snapshot 做实时排名)
 *
 * 每张卡 3 行:icon + symbol · 价格 · 涨跌%
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp, TrendingDown, Flame, Sparkles, BarChart3, Rocket } from 'lucide-react';
import { fetchTokensInfoBatch, type TokenInfo } from '@/lib/portfolio';
import { useTranslations } from 'next-intl';

// 预设热门 mint — 从用户已开 ATA + 蓝筹 + 热门 meme 里挑
const HOT_MINTS = [
  'So11111111111111111111111111111111111111112',  // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
];

const MEME_MINTS = [
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Portal)
];

const LST_MINTS = [
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',  // bSOL
];

const VOL_MINTS = [
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
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
    <section className="px-4 sm:px-6 py-10 sm:py-14">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {t('title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SnapCard
            Icon={Flame}
            label={t('hot')}
            tokens={pick(HOT_MINTS)}
          />
          <SnapCard
            Icon={Sparkles}
            label={t('meme')}
            tokens={pick(MEME_MINTS)}
          />
          <SnapCard
            Icon={Rocket}
            label={t('lst')}
            tokens={pick(LST_MINTS)}
          />
          <SnapCard
            Icon={BarChart3}
            label={t('stables')}
            tokens={pick(VOL_MINTS)}
          />
        </div>
      </div>
    </section>
  );
}

function SnapCard({
  Icon,
  label,
  tokens,
}: {
  Icon: typeof Flame;
  label: string;
  tokens: TokenInfo[];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="divide-y divide-border/30">
        {tokens.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 h-[52px]">
                <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-3 w-14 bg-muted animate-pulse rounded" />
              </div>
            ))
          : tokens.map((tok) => (
              <Link
                key={tok.mint}
                href={`/token/${tok.mint}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                  <div className="text-sm font-medium truncate">{tok.symbol}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-mono">${formatPrice(tok.priceUsd)}</div>
                </div>
                <PriceChange change={tok.priceChange24h} />
              </Link>
            ))}
      </div>
    </div>
  );
}

function PriceChange({ change }: { change?: number }) {
  if (change == null) return <span className="text-xs text-muted-foreground w-14 text-right">—</span>;
  const up = change > 0;
  const down = change < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : null;
  const color = up
    ? 'text-success'
    : down
    ? 'text-danger'
    : 'text-muted-foreground';
  return (
    <span className={`text-xs font-mono flex items-center gap-0.5 w-14 justify-end ${color}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {`${up ? '+' : ''}${change.toFixed(2)}%`}
    </span>
  );
}

function formatPrice(n: number): string {
  if (!n) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}
