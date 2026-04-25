'use client';

/**
 * Landing 页 · 代币行情主表(币安风)
 *
 * tabs: 全部 / 蓝筹 / Meme / LST / 稳定币
 * 表格列: 名称 / 价格 / 24h 涨跌 / 24h 成交量 / 市值 / 操作
 * 排序: 默认按市值降序
 * 操作: 跳 /trade?mint=X 一键交易,跳 /token/{mint} 看详情
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, ShoppingCart, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchTokensInfoBatch, fetchTokenInfo, type TokenInfo } from '@/lib/portfolio';
import {
  PRESET_ALL, PRESET_MAJORS, PRESET_MEME, PRESET_STABLE,
} from '@/lib/preset-tokens';
import { useFavorites } from '@/lib/favorites';
import { MiniSparkline } from '@/components/common/mini-sparkline';
import { TokenTags, tagsFor } from '@/components/common/token-tags';

const ALL = PRESET_ALL;

const GROUPS: Record<string, string[]> = {
  all: ALL,
  major: PRESET_MAJORS,
  meme: PRESET_MEME,
  stable: PRESET_STABLE,
};

type Tab = 'fav' | 'all' | 'major' | 'meme' | 'stable';

export function TokenList() {
  const t = useTranslations('landing.tokenList');
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [infos, setInfos] = useState<Map<string, TokenInfo>>(new Map());
  const { favorites, isFavorite, toggle } = useFavorites();

  useEffect(() => {
    fetchTokensInfoBatch(ALL).then(setInfos).catch(() => {});
  }, []);

  // 自选里有 PRESET 没收录的 mint,补拉一次
  useEffect(() => {
    const missing = favorites.filter((m) => !infos.has(m));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((m) => fetchTokenInfo(m))).then((arr) => {
      if (cancelled) return;
      setInfos((prev) => {
        const next = new Map(prev);
        arr.forEach((info, i) => { if (info) next.set(missing[i], info); });
        return next;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [favorites, infos]);

  const rows = useMemo(() => {
    const sourceMints = tab === 'fav' ? favorites : (GROUPS[tab] || ALL);
    const list = sourceMints
      .map((m) => infos.get(m))
      .filter((t): t is TokenInfo => !!t && !!t.logoUri);
    // 默认按 24h 成交量降序;成交量为空的排到最后,按市值兜底
    return list.sort((a, b) => {
      const va = a.volume24h ?? 0;
      const vb = b.volume24h ?? 0;
      if (va !== vb) return vb - va;
      return (b.marketCap ?? 0) - (a.marketCap ?? 0);
    });
  }, [tab, infos]);

  return (
    <section className="px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-heading">
              {t('title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
          <Tabs value={tab} onValueChange={(v) => v && setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="fav">
                <Star className="h-3 w-3 mr-1" />
                {t('tabs.fav')}{favorites.length > 0 ? ` ${favorites.length}` : ''}
              </TabsTrigger>
              <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
              <TabsTrigger value="major">{t('tabs.major')}</TabsTrigger>
              <TabsTrigger value="meme">{t('tabs.meme')}</TabsTrigger>
              <TabsTrigger value="stable">{t('tabs.stable')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>{t('cols.name')}</TableHead>
                <TableHead className="text-right">{t('cols.price')}</TableHead>
                <TableHead className="text-right">{t('cols.change')}</TableHead>
                <TableHead className="text-right hidden md:table-cell">
                  {t('cols.volume')}
                </TableHead>
                <TableHead className="text-right hidden md:table-cell">
                  {t('cols.mcap')}
                </TableHead>
                <TableHead className="text-right">{t('cols.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0
                ? tab === 'fav' ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-20 text-center text-muted-foreground text-xs">
                        {t('emptyFav')}
                      </TableCell>
                    </TableRow>
                  ) : Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-12 text-center text-muted-foreground text-xs">
                        ⌛ loading…
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((tok) => (
                    <Row
                      key={tok.mint}
                      tok={tok}
                      starred={isFavorite(tok.mint)}
                      onToggleStar={() => toggle(tok.mint)}
                      onTrade={() => router.push(`/trade?mint=${tok.mint}`)}
                    />
                  ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </section>
  );
}

function Row({
  tok, starred, onToggleStar, onTrade,
}: {
  tok: TokenInfo;
  starred: boolean;
  onToggleStar: () => void;
  onTrade: () => void;
}) {
  const change = tok.priceChange24h;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  const ChangeIcon = up ? TrendingUp : down ? TrendingDown : null;
  const color = up ? 'text-success' : down ? 'text-danger' : 'text-muted-foreground';

  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell className="pr-0">
        <button
          type="button"
          onClick={onToggleStar}
          aria-label={starred ? 'Remove favorite' : 'Add favorite'}
          className="p-1 hover:bg-muted/40 rounded transition-colors"
        >
          <Star
            className={`h-4 w-4 ${
              starred ? 'fill-warning text-warning' : 'text-muted-foreground/40'
            }`}
          />
        </button>
      </TableCell>
      <TableCell>
        <Link href={`/token/${tok.mint}`} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {tok.logoUri ? (
              <Image
                src={tok.logoUri}
                alt={tok.symbol}
                width={32}
                height={32}
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground">
                {tok.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium truncate">{tok.symbol}</span>
              <TokenTags kinds={tagsFor(tok)} />
            </div>
            {tok.name && tok.name !== tok.symbol && (
              <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                {tok.name}
              </div>
            )}
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm whitespace-nowrap">
        ${formatPrice(tok.priceUsd)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <MiniSparkline
            priceUsd={tok.priceUsd}
            change24h={tok.priceChange24h}
            change6h={tok.priceChange6h}
            change1h={tok.priceChange1h}
            change5m={tok.priceChange5m}
            width={50}
            height={18}
          />
          <span className={`text-xs font-mono inline-flex items-center gap-0.5 justify-end ${color}`}>
            {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
            {change != null ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
        {tok.volume24h ? `$${formatCompact(tok.volume24h)}` : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
        ${formatCompact(tok.marketCap)}
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-primary" onClick={onTrade}>
          <ShoppingCart className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
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
