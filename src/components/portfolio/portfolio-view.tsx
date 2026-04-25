'use client';

/**
 * 持仓页主 UI(升级版)
 *
 * 布局:
 *  ┌── 总值卡(大数字)── 7d/30d 曲线 ─┐
 *  │                                  │
 *  │  ┌── 资产分布饼 ──┐  ┌── 图例 ──┐│
 *  │  └────────────────┘  └──────────┘│
 *  │                                  │
 *  │  Tabs: 持仓 / 已平仓             │
 *  └──────────────────────────────────┘
 */
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { RefreshCw, Wallet, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useCostBasis } from '@/hooks/use-cost-basis';
import { getClosedPositions } from '@/lib/cost-basis';
import {
  appendSnapshot,
  readSnapshots,
  type Snapshot,
} from '@/lib/portfolio-history';
import { readFees, type FeeTotal } from '@/lib/fee-tracker';

import { HoldingsTable } from './holdings-table';
import { ClosedPositions } from './closed-positions';
import { AssetPie, AssetPieLegend } from './asset-pie';
import { ValueChart } from './value-chart';
import { SavingsCard } from './savings-card';

export function PortfolioView() {
  const t = useTranslations();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { sol, tokens, totalUsd, loading, error, refresh } = usePortfolio();
  const { costs } = useCostBasis();
  const [tab, setTab] = useState<'holdings' | 'closed'>('holdings');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [fees, setFees] = useState<FeeTotal>({
    ocufiSol: 0, networkSol: 0, txCount: 0, volumeSol: 0, startedAt: 0, lastAt: 0,
  });

  const walletAddr = wallet.publicKey?.toBase58() ?? '';

  // 钱包切换时读快照 + 累计手续费
  useEffect(() => {
    if (!walletAddr) {
      setSnapshots([]);
      setFees({ ocufiSol: 0, networkSol: 0, txCount: 0, volumeSol: 0, startedAt: 0, lastAt: 0 });
      return;
    }
    setSnapshots(readSnapshots(walletAddr));
    setFees(readFees(walletAddr));
  }, [walletAddr]);

  // 持仓加载完毕,且金额大于 0,才追加快照(避免 loading 期间记 0)
  useEffect(() => {
    if (!walletAddr || loading || totalUsd <= 0) return;
    const updated = appendSnapshot(walletAddr, totalUsd);
    setSnapshots(updated);
  }, [walletAddr, loading, totalUsd]);

  const closed = useMemo(() => getClosedPositions(costs), [costs]);

  // 组装 pie 数据:SOL + 每个 token
  const pieItems = useMemo(() => {
    const items: Array<{ symbol: string; valueUsd: number }> = [];
    if (sol.amount > 0 && sol.valueUsd > 0) {
      items.push({ symbol: 'SOL', valueUsd: sol.valueUsd });
    }
    for (const tk of tokens) {
      if (tk.valueUsd > 0) items.push({ symbol: tk.symbol, valueUsd: tk.valueUsd });
    }
    return items;
  }, [sol, tokens]);

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
    <div className="w-full max-w-5xl space-y-4">
      {/* 顶部:总值 + 7d/30d 曲线 */}
      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-4">
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
            <div className="text-3xl sm:text-4xl font-bold font-mono tracking-tight">
              ${formatUsd(totalUsd)}
            </div>
            <div className="text-xs text-muted-foreground mt-2 font-mono">
              {shortAddr(walletAddr)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <ValueChart snapshots={snapshots} currentTotalUsd={totalUsd} />
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

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
        <>
          {/* 已节省手续费 · 病毒传播触发点 · 仅在有过成交时显示 */}
          {fees.txCount > 0 && fees.volumeSol > 0 && (
            <SavingsCard
              volumeSol={fees.volumeSol}
              txCount={fees.txCount}
              solUsdPrice={sol.amount > 0 ? sol.valueUsd / sol.amount : 0}
            />
          )}

          {/* 资产分布 */}
          {pieItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.distribution')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-[180px_1fr] gap-6 items-center">
                  <div className="flex items-center justify-center">
                    <AssetPie items={pieItems} totalUsd={totalUsd} size={180} />
                  </div>
                  <AssetPieLegend items={pieItems} totalUsd={totalUsd} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 累计手续费 · 透明展示我们和网络收了你多少 */}
          {fees.txCount > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('portfolio.feesTotal.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {t('portfolio.feesTotal.ocufi')}
                    </div>
                    <div className="text-base sm:text-lg font-mono font-semibold mt-1">
                      {fees.ocufiSol.toFixed(6)}
                      <span className="text-[10px] text-muted-foreground/60 ml-1">SOL</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {t('portfolio.feesTotal.network')}
                    </div>
                    <div className="text-base sm:text-lg font-mono font-semibold mt-1">
                      {fees.networkSol.toFixed(6)}
                      <span className="text-[10px] text-muted-foreground/60 ml-1">SOL</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {t('portfolio.feesTotal.txCount')}
                    </div>
                    <div className="text-base sm:text-lg font-mono font-semibold mt-1 tabular-nums">
                      {fees.txCount}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-3">
                  {t('portfolio.feesTotal.note')}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs:持仓 / 已平仓 */}
          <Card className="p-4">
            <Tabs value={tab} onValueChange={(v) => v && setTab(v as 'holdings' | 'closed')}>
              <TabsList className="bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-5 px-0 mb-4 h-auto">
                <TabsTrigger
                  value="holdings"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground"
                >
                  {t('portfolio.tabs.holdings')}
                  {tokens.length > 0 ? ` ${tokens.length + (sol.amount > 0 ? 1 : 0)}` : ''}
                </TabsTrigger>
                <TabsTrigger
                  value="closed"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground"
                >
                  {t('portfolio.tabs.closed')}
                  {closed.length > 0 ? ` ${closed.length}` : ''}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="holdings">
                <HoldingsTable sol={sol} tokens={tokens} costs={costs} />
              </TabsContent>
              <TabsContent value="closed">
                <ClosedPositions list={closed} />
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}

      <div className="text-xs text-muted-foreground text-center pt-2">
        {t('portfolio.autoRefreshHint')}
      </div>
    </div>
  );
}

function shortAddr(s: string): string {
  return s ? s.slice(0, 4) + '…' + s.slice(-4) : '';
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
