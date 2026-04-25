'use client';

/**
 * 已平仓 tab · 显示余额清零的代币 + 已实现 PnL
 *
 * PnL 全部用 SOL 计价(简单可靠;USD 计价需要每笔 tx 时点 SOL/USD,V2 再加)
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { ClosedPosition } from '@/lib/cost-basis';

interface Props {
  list: ClosedPosition[];
}

export function ClosedPositions({ list }: Props) {
  const t = useTranslations('portfolio.closed');

  if (list.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground space-y-1">
        <div className="font-medium">{t('empty.title')}</div>
        <div className="text-xs text-muted-foreground/70">
          {t('empty.subtitle')}
        </div>
      </div>
    );
  }

  const totalPnl = list.reduce((s, p) => s + p.realizedPnlSol, 0);
  const totalPct = (() => {
    const totalCost = list.reduce((s, p) => s + p.totalBoughtSol, 0);
    return totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  })();
  const totalColor =
    totalPnl > 0 ? 'text-success' : totalPnl < 0 ? 'text-danger' : 'text-muted-foreground';

  return (
    <div className="space-y-3">
      {/* 汇总条 */}
      <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 text-xs">
        <span className="text-muted-foreground">{t('summary')}</span>
        <span className={`font-mono font-medium ${totalColor}`}>
          {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(4)} SOL
          <span className="ml-2 text-[10px]">({totalPct >= 0 ? '+' : ''}{totalPct.toFixed(2)}%)</span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t('cols.token')}</TableHead>
              <TableHead className="text-right">{t('cols.bought')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('cols.sold')}</TableHead>
              <TableHead className="text-right">{t('cols.pnlSol')}</TableHead>
              <TableHead className="text-right">{t('cols.pnlPct')}</TableHead>
              <TableHead className="text-right hidden md:table-cell">{t('cols.closedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => (
              <Row key={p.mint} p={p} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Row({ p }: { p: ClosedPosition }) {
  const pnlColor =
    p.realizedPnlSol > 0 ? 'text-success' : p.realizedPnlSol < 0 ? 'text-danger' : 'text-muted-foreground';
  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell>
        <Link
          href={`/token/${p.mint}`}
          className="flex items-center gap-2 hover:text-primary transition-colors"
        >
          <span className="font-mono text-xs text-muted-foreground/70">
            {p.mint.slice(0, 6)}…{p.mint.slice(-4)}
          </span>
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {p.totalBoughtSol.toFixed(4)} SOL
      </TableCell>
      <TableCell className="text-right font-mono text-xs hidden sm:table-cell">
        {p.totalSoldSol.toFixed(4)} SOL
      </TableCell>
      <TableCell className={`text-right font-mono font-medium ${pnlColor}`}>
        {p.realizedPnlSol >= 0 ? '+' : ''}{p.realizedPnlSol.toFixed(4)}
      </TableCell>
      <TableCell className={`text-right font-mono text-xs ${pnlColor}`}>
        {p.realizedPnlPct >= 0 ? '+' : ''}{p.realizedPnlPct.toFixed(2)}%
      </TableCell>
      <TableCell className="text-right font-mono text-[10px] text-muted-foreground hidden md:table-cell">
        {p.closedAt > 0 ? formatDate(p.closedAt) : '—'}
      </TableCell>
    </TableRow>
  );
}

function formatDate(seconds: number): string {
  const d = new Date(seconds * 1000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
