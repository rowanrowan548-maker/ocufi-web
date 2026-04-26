'use client';

/**
 * 当前持仓表(SOL + 所有 SPL)
 * 从 portfolio-view 抽出来,方便配合 tabs 切换
 */
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getCurrentChain } from '@/config/chains';
import type { CostEntry } from '@/lib/cost-basis';

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
}

export function HoldingsTable({ sol, tokens, costs }: Props) {
  const t = useTranslations();
  const chain = getCurrentChain();

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead>{t('portfolio.columns.token')}</TableHead>
            <TableHead className="text-right">{t('portfolio.columns.amount')}</TableHead>
            <TableHead className="text-right">{t('portfolio.columns.price')}</TableHead>
            <TableHead className="text-right hidden md:table-cell">{t('portfolio.columns.avgCost')}</TableHead>
            <TableHead className="text-right hidden md:table-cell">{t('portfolio.columns.pnl')}</TableHead>
            <TableHead className="text-right">{t('portfolio.columns.value')}</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sol.amount > 0 && (
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    ◎
                  </div>
                  <div>
                    <div className="font-medium">SOL</div>
                    <div className="text-xs text-muted-foreground">Solana</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatAmount(sol.amount)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                ${(sol.valueUsd / Math.max(sol.amount, 1e-9)).toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground text-xs hidden md:table-cell">—</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground text-xs hidden md:table-cell">—</TableCell>
              <TableCell className="text-right font-mono font-medium">
                ${formatUsd(sol.valueUsd)}
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          )}
          {tokens.map((tok) => {
            const solUsd = sol.amount > 0 ? sol.valueUsd / sol.amount : 0;
            const cost = costs.get(tok.mint);
            const avgCostUsd = cost && cost.avgCostSol > 0 && solUsd > 0
              ? cost.avgCostSol * solUsd
              : null;
            const pnlPct = avgCostUsd != null && avgCostUsd > 0 && tok.priceUsd > 0
              ? ((tok.priceUsd - avgCostUsd) / avgCostUsd) * 100
              : null;
            return (
              <TableRow key={tok.mint}>
                <TableCell>
                  <Link
                    href={`/trade?mint=${tok.mint}`}
                    className="flex items-center gap-3 hover:bg-muted/50 -mx-4 -my-2 px-4 py-2 rounded transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                        <span className="text-xs font-bold text-muted-foreground">
                          {tok.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{tok.symbol}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {tok.mint.slice(0, 4)}…{tok.mint.slice(-4)}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatAmount(tok.amount)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {tok.priceUsd > 0 ? `$${formatPrice(tok.priceUsd)}` : '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                  {avgCostUsd != null ? `$${formatPrice(avgCostUsd)}` : '—'}
                </TableCell>
                <TableCell className={`text-right font-mono text-xs hidden md:table-cell ${pnlColor(pnlPct)}`}>
                  {pnlPct != null
                    ? `${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%`
                    : '—'}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {tok.valueUsd > 0 ? `$${formatUsd(tok.valueUsd)}` : '—'}
                </TableCell>
                <TableCell>
                  <a
                    href={`${chain.explorer}/token/${tok.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex p-1 text-muted-foreground hover:text-foreground"
                    title={t('portfolio.viewOnExplorer')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

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

function pnlColor(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct > 0) return 'text-success font-medium';
  if (pct < 0) return 'text-danger font-medium';
  return 'text-muted-foreground';
}
