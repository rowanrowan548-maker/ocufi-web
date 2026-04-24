'use client';

/**
 * 持仓页主 UI
 * 未连接钱包 → 提示连接
 * 加载中     → 骨架
 * 空持仓     → 空状态 + CTA 到 /trade
 * 有持仓     → 总值卡片 + 代币表格
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { RefreshCw, Wallet, AlertCircle, ExternalLink } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useCostBasis } from '@/hooks/use-cost-basis';
import { getCurrentChain } from '@/config/chains';

export function PortfolioView() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { sol, tokens, totalUsd, loading, error, refresh } = usePortfolio();
  const { costs } = useCostBasis();

  // 未连接
  if (!wallet.connected || !wallet.publicKey) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('portfolio.notConnected')}</p>
          <Button onClick={() => openWalletModal(true)}>
            {t('wallet.connect')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasAnyHolding = sol.amount > 0 || tokens.length > 0;

  return (
    <div className="w-full max-w-4xl space-y-4">
      {/* 总值卡片 · gmgn 式大数字 */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 0% 0%, oklch(0.88 0.25 155 / 8%), transparent 70%)',
          }}
        />
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('portfolio.totalValue')}
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={refresh}
              disabled={loading}
              className="h-8 px-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-4xl sm:text-5xl font-bold font-mono tracking-tight">
            ${formatUsd(totalUsd)}
          </div>
          <div className="text-xs text-muted-foreground mt-2 font-mono">
            {shortAddr(wallet.publicKey.toBase58())}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {/* SOL + 代币表格 */}
      {!hasAnyHolding && !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-muted-foreground">{t('portfolio.empty')}</p>
            <Link href="/trade">
              <Button>{t('portfolio.goTrade')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
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
              {/* SOL 永远在首行 */}
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
                        href={`/token/${tok.mint}`}
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
                            {shortAddr(tok.mint)}
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
        </Card>
      )}

      <div className="text-xs text-muted-foreground text-center pt-2">
        {t('portfolio.autoRefreshHint')}
      </div>
    </div>
  );
}

// ─── 格式化工具 ───
function shortAddr(s: string): string {
  return s ? s.slice(0, 4) + '…' + s.slice(-4) : '';
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
  if (pct > 0) return 'text-green-600 dark:text-green-400 font-medium';
  if (pct < 0) return 'text-red-600 dark:text-red-400 font-medium';
  return 'text-muted-foreground';
}
