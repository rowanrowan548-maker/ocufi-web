'use client';

/**
 * 自选页 · 单独路由 /watchlist
 *
 * 显示所有 localStorage 收藏的代币 + 实时行情
 * 空状态:引导用户去 Landing 行情表加自选
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TrendingUp, TrendingDown, ShoppingCart, Star, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { fetchTokenInfo, type TokenInfo } from '@/lib/portfolio';
import { useFavorites } from '@/lib/favorites';

export function WatchlistScreen() {
  const t = useTranslations('watchlist');
  const router = useRouter();
  const { favorites, toggle } = useFavorites();
  const [infos, setInfos] = useState<Map<string, TokenInfo>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (favorites.length === 0) {
      setInfos(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(favorites.map((m) => fetchTokenInfo(m)))
      .then((arr) => {
        if (cancelled) return;
        const next = new Map<string, TokenInfo>();
        arr.forEach((info, i) => { if (info) next.set(favorites[i], info); });
        setInfos(next);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [favorites]);

  const rows = useMemo(() => {
    return favorites
      .map((m) => infos.get(m))
      .filter((t): t is TokenInfo => !!t);
  }, [favorites, infos]);

  return (
    <main className="flex flex-1 flex-col">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
            {t('page.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('page.subtitle', { count: favorites.length })}
          </p>
        </header>

        {favorites.length === 0 ? (
          <Card className="p-10 sm:p-14 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center">
              <Star className="h-8 w-8 text-warning/70" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold">{t('empty.title')}</div>
              <div className="text-sm text-muted-foreground max-w-sm">
                {t('empty.subtitle')}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-center pt-2">
              <Link href="/">
                <Button size="sm" variant="outline">
                  <Search className="h-4 w-4 mr-2" />
                  {t('empty.browseTokens')}
                </Button>
              </Link>
              <Link href="/trade">
                <Button size="sm">
                  {t('empty.goTrade')}
                </Button>
              </Link>
            </div>
          </Card>
        ) : loading && rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            ⌛ loading…
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t('cols.name')}</TableHead>
                  <TableHead className="text-right">{t('cols.price')}</TableHead>
                  <TableHead className="text-right">{t('cols.change')}</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    {t('cols.volume')}
                  </TableHead>
                  <TableHead className="text-right">{t('cols.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((tok) => (
                  <Row
                    key={tok.mint}
                    tok={tok}
                    onUnstar={() => toggle(tok.mint)}
                    onTrade={() => router.push(`/trade?mint=${tok.mint}`)}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </main>
  );
}

function Row({
  tok, onUnstar, onTrade,
}: {
  tok: TokenInfo;
  onUnstar: () => void;
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
          onClick={onUnstar}
          aria-label="Remove from watchlist"
          className="p-1 hover:bg-muted/40 rounded transition-colors"
        >
          <Star className="h-4 w-4 fill-warning text-warning" />
        </button>
      </TableCell>
      <TableCell>
        <Link href={`/token/${tok.mint}`} className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {tok.logoUri ? (
              <Image
                src={tok.logoUri}
                alt={tok.symbol}
                width={28}
                height={28}
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
            <div className="text-sm font-medium truncate">{tok.symbol}</div>
            <div className="text-[10px] font-mono text-muted-foreground/60">
              {tok.mint.slice(0, 6)}…{tok.mint.slice(-4)}
            </div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm whitespace-nowrap">
        ${formatPrice(tok.priceUsd)}
      </TableCell>
      <TableCell className="text-right">
        <span className={`text-xs font-mono inline-flex items-center gap-0.5 justify-end ${color}`}>
          {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
          {change != null ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
        {tok.volume24h ? `$${formatCompact(tok.volume24h)}` : '—'}
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
