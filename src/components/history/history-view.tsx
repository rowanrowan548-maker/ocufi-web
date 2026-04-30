'use client';

/**
 * 成交历史页 UI
 * 未连接钱包 → 提示连接
 * 加载中     → 骨架提示
 * 空数据     → 空状态
 * 有数据     → 表格:时间 / 类型 / 代币 / 数量 / SOL / Solscan
 */
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import {
  RefreshCw, Wallet, AlertCircle, ExternalLink,
  ArrowDownToLine, ArrowUpFromLine, ArrowDownLeft, ArrowUpRight, Minus, Gift,
  CheckCircle2, XCircle, RotateCw,
} from 'lucide-react';
import { track } from '@/lib/analytics';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTxHistory, type EnrichedTxRecord } from '@/hooks/use-tx-history';
import { getCurrentChain } from '@/config/chains';
import { fetchSolUsdPrice } from '@/lib/portfolio';

// T-HIST-92 · 筛选状态(localStorage 持久化)
const FILTERS_KEY = 'ocufi.history.filters.v1';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

type TokenFilter = 'all' | 'sol' | 'usdc' | 'custom';
type TimeFilter = 'all' | '24h' | '7d' | '30d';
type StatusFilter = 'all' | 'success' | 'failed';

interface Filters {
  token: TokenFilter;
  customMint: string;
  time: TimeFilter;
  status: StatusFilter;
  minSol: string;
  maxSol: string;
}

const DEFAULT_FILTERS: Filters = {
  token: 'all', customMint: '', time: 'all', status: 'all', minSol: '', maxSol: '',
};

function loadFilters(): Filters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(FILTERS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Filters) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(f: Filters): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(FILTERS_KEY, JSON.stringify(f)); } catch { /* noop */ }
}

function applyFilters(records: EnrichedTxRecord[], f: Filters): EnrichedTxRecord[] {
  const now = Date.now() / 1000;
  const timeCutoff =
    f.time === '24h' ? now - 86400 :
    f.time === '7d' ? now - 86400 * 7 :
    f.time === '30d' ? now - 86400 * 30 :
    null;
  const minSol = f.minSol ? parseFloat(f.minSol) : null;
  const maxSol = f.maxSol ? parseFloat(f.maxSol) : null;
  const customNeedle = f.customMint.trim().toLowerCase();
  return records.filter((r) => {
    if (timeCutoff !== null && (r.blockTime ?? 0) <= timeCutoff) return false;
    if (f.status === 'success' && r.err) return false;
    if (f.status === 'failed' && !r.err) return false;
    if (f.token === 'sol' && r.tokenMint) return false;
    if (f.token === 'usdc' && r.tokenMint !== USDC_MINT) return false;
    if (f.token === 'custom' && customNeedle && !r.tokenMint.toLowerCase().includes(customNeedle)) return false;
    if (minSol !== null && (r.solAmount || 0) < minSol) return false;
    if (maxSol !== null && (r.solAmount || 0) > maxSol) return false;
    return true;
  });
}

export function HistoryView() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { records, loading, error, refresh } = useTxHistory(100);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => {
    setFilters(loadFilters());
  }, []);

  function updateFilters(patch: Partial<Filters>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      saveFilters(next);
      return next;
    });
  }

  const filteredRecords = useMemo(() => applyFilters(records, filters), [records, filters]);
  const filtersActive =
    filters.token !== 'all' || filters.time !== 'all' || filters.status !== 'all' ||
    filters.minSol !== '' || filters.maxSol !== '';

  useEffect(() => {
    if (wallet.publicKey) {
      track('history_view', { wallet: wallet.publicKey.toBase58() });
    }
  }, [wallet.publicKey]);

  if (!wallet.connected || !wallet.publicKey) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('history.notConnected')}</p>
          <Button onClick={() => openWalletModal(true)}>
            {t('wallet.connect')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtersActive
            ? t('history.countHintFiltered', { n: filteredRecords.length, total: records.length })
            : t('history.countHint', { n: records.length })}
        </p>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-8 px-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <HistoryFilters filters={filters} onChange={updateFilters} active={filtersActive} />

      {error && (
        <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {!loading && filteredRecords.length === 0 && !error && filtersActive ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-sm text-muted-foreground">{t('history.emptyFiltered')}</p>
            <Button size="sm" variant="outline" onClick={() => updateFilters(DEFAULT_FILTERS)}>
              {t('history.filters.reset')}
            </Button>
          </CardContent>
        </Card>
      ) : !loading && records.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-muted-foreground">{t('history.empty')}</p>
            <Link href="/trade">
              <Button>{t('portfolio.goTrade')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
        <HistoryStats24h records={filteredRecords} />
        <Card className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('history.columns.time')}</TableHead>
                <TableHead>{t('history.columns.type')}</TableHead>
                <TableHead className="w-[60px]">{t('history.columns.status')}</TableHead>
                <TableHead>{t('history.columns.token')}</TableHead>
                <TableHead className="text-right">{t('history.columns.tokenAmount')}</TableHead>
                <TableHead className="text-right">{t('history.columns.solAmount')}</TableHead>
                {/* T-929-cont #91:成交价 / 滑点 / 优先费 / Gas 4 列 */}
                <TableHead className="text-right hidden md:table-cell">{t('history.columns.execPrice')}</TableHead>
                <TableHead className="text-right hidden md:table-cell">{t('history.columns.slippage')}</TableHead>
                <TableHead className="text-right hidden md:table-cell">{t('history.columns.priorityFee')}</TableHead>
                <TableHead className="text-right hidden md:table-cell">{t('history.columns.gasFee')}</TableHead>
                <TableHead className="font-mono text-[11px]">{t('history.columns.signature')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((r) => (
                <HistoryRow key={r.signature} r={r} explorer={chain.explorer} t={t} />
              ))}
            </TableBody>
          </Table>
        </Card>
        </>
      )}
    </div>
  );
}

// T-HIST-94 · 24h 聚合卡 · 4 数字横排
// 数据 100% 本地计算(filter past 24h then reduce),不打后端
function HistoryStats24h({ records }: { records: EnrichedTxRecord[] }) {
  const t = useTranslations();
  const [solUsd, setSolUsd] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSolUsdPrice().then((p) => { if (alive) setSolUsd(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    const now = Date.now() / 1000;
    const cutoff = now - 86400;
    const recent = records.filter((r) => !r.err && (r.blockTime ?? 0) > cutoff);
    const trades = recent.filter((r) => r.type === 'buy' || r.type === 'sell');
    const count = trades.length;
    const volumeSol = trades.reduce((s, r) => s + (r.solAmount || 0), 0);
    const buyTotalSol = trades.filter((r) => r.type === 'buy').reduce((s, r) => s + (r.solAmount || 0), 0);
    const sellTotalSol = trades.filter((r) => r.type === 'sell').reduce((s, r) => s + (r.solAmount || 0), 0);
    const netSol = sellTotalSol - buyTotalSol;
    const feeSol = recent.reduce(
      (s, r) => s + (r.feeSol || 0) + (r.priorityFeeSol || 0) + (r.gasFeeSol || 0),
      0,
    );
    return { count, volumeSol, netSol, feeSol };
  }, [records]);

  const sol = solUsd ?? 0;
  const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const fmtSol = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Stat label={t('history.stats.count')} value={String(stats.count)} sub={t('history.stats.last24h')} />
          <Stat
            label={t('history.stats.volume')}
            value={solUsd ? fmtUsd(stats.volumeSol * sol) : `${fmtSol(stats.volumeSol)} SOL`}
            sub={solUsd ? `${fmtSol(stats.volumeSol)} SOL` : t('history.stats.last24h')}
          />
          <Stat
            label={t('history.stats.pnl')}
            value={solUsd ? fmtUsd(stats.netSol * sol) : `${fmtSol(stats.netSol)} SOL`}
            sub={solUsd ? `${fmtSol(stats.netSol)} SOL` : t('history.stats.netFlow')}
            tone={stats.netSol > 0 ? 'pos' : stats.netSol < 0 ? 'neg' : undefined}
          />
          <Stat
            label={t('history.stats.fees')}
            value={solUsd ? fmtUsd(stats.feeSol * sol) : `${fmtSol(stats.feeSol)} SOL`}
            sub={solUsd ? `${fmtSol(stats.feeSol)} SOL` : t('history.stats.last24h')}
          />
        </div>
        {!solUsd && (
          <div className="mt-2 text-[10px] text-muted-foreground/60 text-right">
            {t('history.stats.usdPending')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' }) {
  const toneClass =
    tone === 'pos' ? 'text-success' :
    tone === 'neg' ? 'text-danger' :
    'text-foreground';
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</span>
      <span className={`text-base sm:text-lg font-semibold tabular-nums truncate ${toneClass}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground/60 tabular-nums truncate">{sub}</span>}
    </div>
  );
}

function HistoryRow({
  r,
  explorer,
  t,
}: {
  r: EnrichedTxRecord;
  explorer: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const typeLabel = t(`history.type.${r.type}`);
  const { Icon, color } = TYPE_STYLE[r.type];

  return (
    <TableRow className={r.err ? 'bg-destructive/5' : ''}>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatTime(r.blockTime)}
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
          <Icon className="h-3.5 w-3.5" />
          {typeLabel}
        </span>
      </TableCell>
      <TableCell>
        {r.err ? (
          <span className="inline-flex items-center gap-1 text-xs text-destructive" title={t('history.status.failed')}>
            <XCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('history.status.failed')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-success" title={t('history.status.success')}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('history.status.success')}</span>
          </span>
        )}
      </TableCell>
      <TableCell>
        {r.type === 'nft_airdrop' || r.type === 'nft' ? (
          <div className="flex items-center gap-2 max-w-[220px]">
            <Gift className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <span className="text-sm font-medium truncate" title={r.nftName || r.description}>
              {r.nftName || r.description || t('history.type.nft_airdrop')}
            </span>
          </div>
        ) : r.tokenMint ? (
          <Link
            href={`/trade?mint=${r.tokenMint}`}
            className="flex items-center gap-2 hover:underline"
          >
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {r.tokenLogo ? (
                <Image
                  src={r.tokenLogo}
                  alt={r.tokenSymbol}
                  width={24}
                  height={24}
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground">
                  {r.tokenSymbol.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium truncate max-w-[100px]">{r.tokenSymbol}</span>
              <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
                ·{r.tokenMint.slice(-4)}
              </span>
            </span>
          </Link>
        ) : r.solAmount > 0 ? (
          <div className="flex items-center gap-2">
            {/* T-REWARDS-POLISH:用 Solana 官方 logo · 不再紫色占位 */}
            <Image
              src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
              alt="SOL"
              width={24}
              height={24}
              className="rounded-full flex-shrink-0"
              unoptimized
            />
            <span className="text-sm font-medium">SOL</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {r.type === 'nft_airdrop' || r.type === 'nft'
          ? '1 NFT'
          : r.tokenMint && r.tokenAmount > 0
          ? formatAmount(r.tokenAmount)
          : !r.tokenMint && r.solAmount > 0
          ? `${formatAmount(r.solAmount)} SOL`
          : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {r.tokenMint && r.solAmount > 0 ? `${formatAmount(r.solAmount)} SOL` : '—'}
      </TableCell>
      {/* T-929-cont #91:成交价 / 滑点 / 优先费 / Gas */}
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
        {r.executionPriceUsd != null ? formatAmount(r.executionPriceUsd) : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
        {r.actualSlippageBps != null ? `${(r.actualSlippageBps / 100).toFixed(2)}%` : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
        {r.priorityFeeSol != null ? `${r.priorityFeeSol.toFixed(6)}` : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
        {r.gasFeeSol != null ? `${r.gasFeeSol.toFixed(6)}` : '—'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <a
            href={`${explorer}/tx/${r.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title={r.signature}
          >
            {r.signature.slice(0, 6)}…
            <ExternalLink className="h-3 w-3" />
          </a>
          {/* T-929 #95:失败买入加重试按钮 */}
          {r.err && r.type === 'buy' && r.tokenMint && (
            <Link
              href={`/trade?mint=${r.tokenMint}&side=buy`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] text-warning hover:bg-warning/10 transition-colors"
              title={t('history.retry')}
            >
              <RotateCw className="h-3 w-3" />
              <span className="hidden md:inline">{t('history.retry')}</span>
            </Link>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

const TYPE_STYLE = {
  buy: { Icon: ArrowDownToLine, color: 'text-success' },
  sell: { Icon: ArrowUpFromLine, color: 'text-danger' },
  receive: { Icon: ArrowDownLeft, color: 'text-blue-600 dark:text-blue-400' },
  send: { Icon: ArrowUpRight, color: 'text-orange-600 dark:text-orange-400' },
  nft_airdrop: { Icon: Gift, color: 'text-purple-600 dark:text-purple-400' },
  nft: { Icon: Gift, color: 'text-purple-600 dark:text-purple-400' },
  other: { Icon: Minus, color: 'text-muted-foreground' },
} as const;

function formatTime(blockTime: number | null): string {
  if (!blockTime) return '—';
  const d = new Date(blockTime * 1000);
  const now = Date.now();
  const diffSec = (now - d.getTime()) / 1000;
  if (diffSec < 60) return `${Math.floor(diffSec)}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d`;
  return d.toLocaleDateString();
}

function formatAmount(n: number): string {
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}

// T-HIST-92 · 筛选条
function HistoryFilters({
  filters, onChange, active,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  active: boolean;
}) {
  const t = useTranslations();

  const tokenOptions: Array<{ value: TokenFilter; label: string }> = [
    { value: 'all', label: t('history.filters.all') },
    { value: 'sol', label: 'SOL' },
    { value: 'usdc', label: 'USDC' },
    { value: 'custom', label: t('history.filters.custom') },
  ];
  const timeOptions: Array<{ value: TimeFilter; label: string }> = [
    { value: 'all', label: t('history.filters.all') },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
  ];
  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: t('history.filters.all') },
    { value: 'success', label: t('history.status.success') },
    { value: 'failed', label: t('history.status.failed') },
  ];

  return (
    <Card>
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('history.filters.title')}
          </span>
          {active && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(DEFAULT_FILTERS)}
            >
              {t('history.filters.reset')}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 代币 */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              {t('history.filters.token')}
            </label>
            <ToggleRow
              options={tokenOptions}
              value={filters.token}
              onChange={(v) => onChange({ token: v as TokenFilter })}
            />
            {filters.token === 'custom' && (
              <input
                type="text"
                placeholder={t('history.filters.customMintPlaceholder')}
                value={filters.customMint}
                onChange={(e) => onChange({ customMint: e.target.value })}
                className="w-full h-7 px-2 text-xs rounded border border-border/40 bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
            )}
          </div>

          {/* 时间 */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              {t('history.filters.time')}
            </label>
            <ToggleRow
              options={timeOptions}
              value={filters.time}
              onChange={(v) => onChange({ time: v as TimeFilter })}
            />
          </div>

          {/* 状态 */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              {t('history.filters.status')}
            </label>
            <ToggleRow
              options={statusOptions}
              value={filters.status}
              onChange={(v) => onChange({ status: v as StatusFilter })}
            />
          </div>

          {/* 金额(SOL) */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              {t('history.filters.amountSol')}
            </label>
            <div className="grid grid-cols-2 gap-1">
              <input
                type="number"
                step="any"
                min="0"
                placeholder={t('history.filters.min')}
                value={filters.minSol}
                onChange={(e) => onChange({ minSol: e.target.value })}
                className="w-full h-7 px-2 text-xs rounded border border-border/40 bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 tabular-nums"
              />
              <input
                type="number"
                step="any"
                min="0"
                placeholder={t('history.filters.max')}
                value={filters.maxSol}
                onChange={(e) => onChange({ maxSol: e.target.value })}
                className="w-full h-7 px-2 text-xs rounded border border-border/40 bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 tabular-nums"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow<V extends string>({
  options, value, onChange,
}: {
  options: Array<{ value: V; label: string }>;
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-0.5 rounded-md border border-border/40 bg-muted/20 p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors truncate ${
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/40'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
