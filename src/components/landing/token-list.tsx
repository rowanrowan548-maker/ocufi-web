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
import { TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchTokensInfoBatch, type TokenInfo } from '@/lib/portfolio';

// ─── mint 池(可按需扩充) ───
const BLUE_CHIPS = [
  'So11111111111111111111111111111111111111112',  // SOL
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Portal)
  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // BTC (Portal)
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',  // RENDER
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
];
const MEME = [
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',  // MEW
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
];
const LST = [
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  '7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn',
  'BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85',
];
const STABLE = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
];

const ALL = Array.from(new Set([...BLUE_CHIPS, ...MEME, ...LST, ...STABLE]));

const GROUPS: Record<string, string[]> = {
  all: ALL,
  blue: BLUE_CHIPS,
  meme: MEME,
  lst: LST,
  stable: STABLE,
};

type Tab = 'all' | 'blue' | 'meme' | 'lst' | 'stable';

export function TokenList() {
  const t = useTranslations('landing.tokenList');
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [infos, setInfos] = useState<Map<string, TokenInfo>>(new Map());

  useEffect(() => {
    fetchTokensInfoBatch(ALL).then(setInfos).catch(() => {});
  }, []);

  const rows = useMemo(() => {
    const list = (GROUPS[tab] || ALL)
      .map((m) => infos.get(m))
      .filter(Boolean) as TokenInfo[];
    return list.sort((a, b) => b.marketCap - a.marketCap);
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
              <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
              <TabsTrigger value="blue">{t('tabs.blue')}</TabsTrigger>
              <TabsTrigger value="meme">{t('tabs.meme')}</TabsTrigger>
              <TabsTrigger value="lst">{t('tabs.lst')}</TabsTrigger>
              <TabsTrigger value="stable">{t('tabs.stable')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">{t('cols.name')}</TableHead>
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
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-12 text-center text-muted-foreground text-xs">
                        ⌛ loading…
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((tok) => (
                    <Row
                      key={tok.mint}
                      tok={tok}
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

function Row({ tok, onTrade }: { tok: TokenInfo; onTrade: () => void }) {
  const change = tok.priceChange24h;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  const ChangeIcon = up ? TrendingUp : down ? TrendingDown : null;
  const color = up ? 'text-success' : down ? 'text-danger' : 'text-muted-foreground';

  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
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
            <div className="text-sm font-medium truncate">{tok.symbol}</div>
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
        <span
          className={`text-xs font-mono inline-flex items-center gap-0.5 justify-end ${color}`}
        >
          {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
          {change != null ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </span>
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
