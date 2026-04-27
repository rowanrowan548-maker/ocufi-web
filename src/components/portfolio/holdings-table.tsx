'use client';

/**
 * 当前持仓表(SOL + 所有 SPL)· T-900b 扩列
 *
 * 桌面 9 列:代币 / 未实现 / 已实现 / 总收益 / 余额 / 持仓时长 / 买卖笔数 / 平均成本 / 操作
 * 移动:每个 token 一张 mini card(关键 3 个数字一屏可见)
 */
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getCurrentChain } from '@/config/chains';
import type { CostEntry } from '@/lib/cost-basis';
import { useCurrency } from '@/lib/currency-store';
import { formatAmount as fmtAmount } from '@/lib/format';

interface Sol { amount: number; valueUsd: number; }
interface Token {
  mint: string;
  symbol: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
  logoUri?: string;
}

interface Props {
  sol: Sol;
  tokens: Token[];
  costs: Map<string, CostEntry>;
  /** T-900c:秒级 cutoff(0 = 全部);只影响行 realized 显示,unrealized 永远基于当前 */
  cutoffSec?: number;
}

interface RowMetrics {
  unrealizedUsd: number | null;
  unrealizedPct: number | null;
  realizedUsd: number | null;
  realizedPct: number | null;
  totalUsd: number | null;
  avgCostUsd: number | null;
  holdSec: number | null;
  buyCount: number;
  sellCount: number;
}

export function HoldingsTable({ sol, tokens, costs, cutoffSec = 0 }: Props) {
  const t = useTranslations();
  const chain = getCurrentChain();
  const currency = useCurrency();
  const solUsd = sol.amount > 0 ? sol.valueUsd / sol.amount : 0;
  const nowSec = Math.floor(Date.now() / 1000);

  function metrics(tok: Token): RowMetrics {
    const cost = costs.get(tok.mint);
    if (!cost) {
      return {
        unrealizedUsd: null, unrealizedPct: null,
        realizedUsd: null, realizedPct: null,
        totalUsd: null, avgCostUsd: null,
        holdSec: null, buyCount: 0, sellCount: 0,
      };
    }
    const avgCostUsd = cost.avgCostSol > 0 && solUsd > 0 ? cost.avgCostSol * solUsd : null;
    const unrealizedUsd =
      avgCostUsd != null && tok.priceUsd > 0
        ? (tok.priceUsd - avgCostUsd) * tok.amount
        : null;
    const unrealizedPct =
      avgCostUsd != null && avgCostUsd > 0 && tok.priceUsd > 0
        ? ((tok.priceUsd - avgCostUsd) / avgCostUsd) * 100
        : null;

    // T-900c:range 过滤 — 若该 token 最近一笔 tx 早于 cutoff,本行 realized 显 —
    // 局限:无 per-sell 时间戳,无法精确分摊到区间内,这里用"区间内有过活动 → 显示全部 realized"近似
    const inRange = cutoffSec <= 0 || cost.lastTxAt > cutoffSec;
    let realizedSol = 0;
    if (cost.totalSoldTokens > 0 && cost.totalBoughtTokens > 0) {
      const avgBuySol = cost.totalBoughtSol / cost.totalBoughtTokens;
      realizedSol = cost.totalSoldSol - cost.totalSoldTokens * avgBuySol;
    }
    const realizedUsd =
      inRange && cost.sellCount > 0 && solUsd > 0 ? realizedSol * solUsd : null;
    const realizedPct =
      inRange && cost.sellCount > 0 && cost.totalBoughtSol > 0
        ? (realizedSol / cost.totalBoughtSol) * 100
        : null;

    const totalUsd =
      unrealizedUsd != null || realizedUsd != null
        ? (unrealizedUsd ?? 0) + (realizedUsd ?? 0)
        : null;

    const holdSec = cost.firstBuyAt > 0 ? nowSec - cost.firstBuyAt : null;

    return {
      unrealizedUsd, unrealizedPct,
      realizedUsd, realizedPct,
      totalUsd, avgCostUsd,
      holdSec,
      buyCount: cost.buyCount,
      sellCount: cost.sellCount,
    };
  }

  return (
    <>
      {/* 移动卡片视图 (< sm) */}
      <div className="grid grid-cols-1 gap-2 sm:hidden">
        {sol.amount > 0 && <SolCard sol={sol} currency={currency} solUsd={solUsd} />}
        {tokens.map((tok) => (
          <TokenCard
            key={tok.mint}
            tok={tok}
            m={metrics(tok)}
            t={t}
            chain={chain}
            currency={currency}
            solUsd={solUsd}
          />
        ))}
      </div>

      {/* 桌面表格 (>= sm) · T-903 行密度 / SOL 行弱化 */}
      <div className="hidden sm:block overflow-x-auto">
        <Table className="min-w-[960px] [&_td]:py-2.5 [&_th]:py-2 [&_tr]:hover:bg-muted/40">
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{t('portfolio.columns.token')}</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70">{t('portfolio.table.unrealized')}</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70 hidden md:table-cell">{t('portfolio.table.realized')}</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70 hidden lg:table-cell">{t('portfolio.table.totalPnl')}</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70">{t('portfolio.columns.value')}</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70 hidden md:table-cell">{t('portfolio.table.holdDuration')}</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70 hidden lg:table-cell">{t('portfolio.table.buySellTxs')}</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70 hidden lg:table-cell">{t('portfolio.columns.avgCost')}</TableHead>
              <TableHead className="text-right w-[110px] text-[11px] uppercase tracking-wider text-muted-foreground/70">{t('portfolio.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sol.amount > 0 && (
              <TableRow className="opacity-60 hover:opacity-100">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Image
                      src="/branding/sol.png"
                      alt="SOL"
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full flex-shrink-0"
                      unoptimized
                    />
                    <div>
                      <div className="font-medium text-[13px] leading-tight">SOL</div>
                      <div className="text-[10px] text-muted-foreground">Solana</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-[11px]">—</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-[11px] hidden md:table-cell">—</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-[11px] hidden lg:table-cell">—</TableCell>
                <TableCell className="text-right font-mono">
                  <div className="font-medium text-[13px] leading-tight">
                    {fmtAmount(sol.valueUsd, currency, solUsd)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{formatAmount(sol.amount)}</div>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-[11px] hidden md:table-cell">—</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-[11px] hidden lg:table-cell">—</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-[11px] hidden lg:table-cell">—</TableCell>
                <TableCell className="text-right">
                  <Link
                    href="/trade"
                    className="inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  >
                    {t('portfolio.table.goTrade')}
                  </Link>
                </TableCell>
              </TableRow>
            )}
            {tokens.map((tok) => {
              const m = metrics(tok);
              return (
                <TableRow key={tok.mint}>
                  <TableCell>
                    <Link
                      href={`/trade?mint=${tok.mint}`}
                      className="flex items-center gap-2.5 hover:bg-muted/50 -mx-3 -my-1.5 px-3 py-1.5 rounded transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                          <span className="text-[11px] font-bold text-muted-foreground">
                            {tok.symbol.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[13px] leading-tight truncate">{tok.symbol}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {tok.mint.slice(0, 4)}…{tok.mint.slice(-4)}
                        </div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <PnlCell usd={m.unrealizedUsd} pct={m.unrealizedPct} />
                  </TableCell>
                  <TableCell className="text-right font-mono hidden md:table-cell">
                    <PnlCell usd={m.realizedUsd} pct={m.realizedPct} />
                  </TableCell>
                  <TableCell className="text-right font-mono hidden lg:table-cell">
                    <PnlCell usd={m.totalUsd} pct={null} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <div className="font-medium text-[13px] leading-tight">
                      {tok.valueUsd > 0 ? fmtAmount(tok.valueUsd, currency, solUsd) : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatAmount(tok.amount)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
                    {m.holdSec != null ? formatDuration(m.holdSec) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] hidden lg:table-cell">
                    <span className="text-success">{m.buyCount}</span>
                    <span className="text-muted-foreground/40 mx-0.5">|</span>
                    <span className="text-danger">{m.sellCount}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden lg:table-cell">
                    {m.avgCostUsd != null ? `$${formatPrice(m.avgCostUsd)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <Link
                        href={`/trade?mint=${tok.mint}&side=buy`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-success hover:bg-success/10"
                        title={t('portfolio.table.buyAction')}
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/trade?mint=${tok.mint}&side=sell`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-danger hover:bg-danger/10"
                        title={t('portfolio.table.sellAction')}
                      >
                        <ArrowUpFromLine className="h-3.5 w-3.5" />
                      </Link>
                      <a
                        href={`${chain.explorer}/token/${tok.mint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        title={t('portfolio.viewOnExplorer')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

// ── Mobile cards ─────────────────────────────────────────────

function SolCard({
  sol,
  currency,
  solUsd,
}: {
  sol: Sol;
  currency: ReturnType<typeof useCurrency>;
  solUsd: number;
}) {
  return (
    <div className="rounded-lg border border-border/40 p-3 bg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/branding/sol.png"
            alt="SOL"
            width={36}
            height={36}
            className="h-9 w-9 rounded-full flex-shrink-0"
            unoptimized
          />
          <div className="min-w-0">
            <div className="font-medium text-sm">SOL</div>
            <div className="text-[10px] text-muted-foreground">Solana</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono font-medium text-sm">
            {fmtAmount(sol.valueUsd, currency, solUsd)}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {formatAmount(sol.amount)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TokenCard({
  tok,
  m,
  t,
  chain,
  currency,
  solUsd,
}: {
  tok: Token;
  m: RowMetrics;
  t: ReturnType<typeof useTranslations>;
  chain: ReturnType<typeof getCurrentChain>;
  currency: ReturnType<typeof useCurrency>;
  solUsd: number;
}) {
  return (
    <div className="rounded-lg border border-border/40 p-3 bg-card space-y-2.5">
      {/* Header: logo + symbol + balance */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/trade?mint=${tok.mint}`}
          className="flex items-center gap-2.5 min-w-0 flex-1"
        >
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {tok.logoUri ? (
              <Image
                src={tok.logoUri}
                alt={tok.symbol}
                width={36}
                height={36}
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-xs font-bold text-muted-foreground">
                {tok.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{tok.symbol}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {tok.mint.slice(0, 4)}…{tok.mint.slice(-4)}
            </div>
          </div>
        </Link>
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-medium text-sm">
            {tok.valueUsd > 0 ? fmtAmount(tok.valueUsd, currency, solUsd) : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {formatAmount(tok.amount)}
          </div>
        </div>
      </div>

      {/* 关键 3 个数字 */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-[10px] text-muted-foreground/70">
            {t('portfolio.table.unrealized')}
          </div>
          <div className={`font-mono ${pnlColorByVal(m.unrealizedUsd)}`}>
            {m.unrealizedUsd != null ? formatPnlUsd(m.unrealizedUsd) : '—'}
          </div>
          {m.unrealizedPct != null && (
            <div className={`text-[10px] font-mono ${pnlColorByVal(m.unrealizedPct)}`}>
              {formatPnlPct(m.unrealizedPct)}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground/70">
            {t('portfolio.table.realized')}
          </div>
          <div className={`font-mono ${pnlColorByVal(m.realizedUsd)}`}>
            {m.realizedUsd != null ? formatPnlUsd(m.realizedUsd) : '—'}
          </div>
          {m.realizedPct != null && (
            <div className={`text-[10px] font-mono ${pnlColorByVal(m.realizedPct)}`}>
              {formatPnlPct(m.realizedPct)}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground/70">
            {t('portfolio.table.totalPnl')}
          </div>
          <div className={`font-mono ${pnlColorByVal(m.totalUsd)}`}>
            {m.totalUsd != null ? formatPnlUsd(m.totalUsd) : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground/60 font-mono">
            {m.holdSec != null ? formatDuration(m.holdSec) : '—'}
            {' · '}
            <span className="text-success">{m.buyCount}</span>
            <span className="text-muted-foreground/40">|</span>
            <span className="text-danger">{m.sellCount}</span>
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/30">
        <Link
          href={`/trade?mint=${tok.mint}&side=buy`}
          className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs text-success hover:bg-success/10"
        >
          <ArrowDownToLine className="h-3 w-3" />
          {t('portfolio.table.buyAction')}
        </Link>
        <Link
          href={`/trade?mint=${tok.mint}&side=sell`}
          className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs text-danger hover:bg-danger/10"
        >
          <ArrowUpFromLine className="h-3 w-3" />
          {t('portfolio.table.sellAction')}
        </Link>
        <a
          href={`${chain.explorer}/token/${tok.mint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          title={t('portfolio.viewOnExplorer')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

// ── PnL cell with $ + % stacked ─────────────────────────────

function PnlCell({ usd, pct }: { usd: number | null; pct: number | null }) {
  if (usd == null) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = pnlColorByVal(usd);
  return (
    <div className="text-xs">
      <div className={`font-medium ${cls}`}>{formatPnlUsd(usd)}</div>
      {pct != null && (
        <div className={`text-[10px] ${cls}`}>{formatPnlPct(pct)}</div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────

function formatAmount(n: number): string {
  if (!n && n !== 0) return '—';
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPrice(n: number): string {
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}

function formatPnlUsd(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}$${formatUsd(Math.abs(n))}`;
}

function formatPnlPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return '<1m';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function pnlColorByVal(v: number | null): string {
  if (v == null || v === 0) return 'text-muted-foreground';
  return v > 0 ? 'text-success' : 'text-danger';
}
