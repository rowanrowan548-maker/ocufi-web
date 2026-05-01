'use client';

/**
 * R10-FE Stage A · /copy-trading 主视图骨架
 *
 * 3 tab:
 *   - discover · 后续接 smart-money 榜 + 手动加 leader 表单
 *   - mine     · 后续接 listSubscriptions
 *   - history  · 后续接 listJobs
 *
 * Stage A 只搭骨架 + wallet gate + i18n · 数据接入留 Stage B/C。
 */
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { Wallet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchStats, type StatsOut } from '@/lib/api/copy-trading';
import { isApiConfigured } from '@/lib/api-client';

type TabKey = 'discover' | 'mine' | 'history';

export function CopyTradingView() {
  const t = useTranslations('copyTrading');
  const { publicKey, connected } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const [tab, setTab] = useState<TabKey>('mine');

  if (!connected || !publicKey) {
    return <ConnectGate t={t} onConnect={() => openWalletModal(true)} />;
  }

  const wallet = publicKey.toBase58();

  return (
    <div className="space-y-4">
      <StatsBar wallet={wallet} />
      <Tabs value={tab} onValueChange={(v) => v && setTab(v as TabKey)}>
        <TabsList className="w-full justify-start gap-1 bg-transparent border-b border-border/40 rounded-none px-0">
          <TabsTrigger value="discover">{t('tabs.discover')}</TabsTrigger>
          <TabsTrigger value="mine">{t('tabs.mine')}</TabsTrigger>
          <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>
        </TabsList>
        <TabsContent value="discover" className="pt-4">
          <DiscoverPlaceholder t={t} />
        </TabsContent>
        <TabsContent value="mine" className="pt-4">
          <MinePlaceholder t={t} />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <HistoryPlaceholder t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectGate({
  t,
  onConnect,
}: {
  t: ReturnType<typeof useTranslations>;
  onConnect: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
        <Wallet className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground max-w-md">
          {t('wallet.connectPrompt')}
        </p>
        <Button onClick={onConnect}>{t('wallet.connect')}</Button>
      </CardContent>
    </Card>
  );
}

function StatsBar({ wallet }: { wallet: string }) {
  const t = useTranslations('copyTrading');
  const [stats, setStats] = useState<StatsOut | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    fetchStats(wallet)
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setStats(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [wallet]);

  const pendingCount = stats?.job_counts_by_status?.pending ?? 0;

  return (
    <Card>
      <CardContent className="py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <Stat label={t('stats.totalSubs')} value={stats?.total_subscriptions ?? '—'} loading={loading} />
        <Stat label={t('stats.active')} value={stats?.active_count ?? '—'} loading={loading} />
        <Stat
          label={t('stats.spent')}
          value={stats?.spent_sol_total != null ? stats.spent_sol_total.toFixed(3) : '—'}
          loading={loading}
        />
        <Stat label={t('stats.pending')} value={pendingCount} loading={loading} />
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : value}
      </span>
    </div>
  );
}

function DiscoverPlaceholder({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {t('discover.comingSoon')}
      </CardContent>
    </Card>
  );
}

function MinePlaceholder({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {t('mine.empty')}
      </CardContent>
    </Card>
  );
}

function HistoryPlaceholder({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {t('history.empty')}
      </CardContent>
    </Card>
  );
}
