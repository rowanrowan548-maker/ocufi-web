'use client';

/**
 * T-REWARDS-PAGE · 奖励中心 · /rewards
 *
 * 顶部:钱包地址 + "已累计回收 X.XXX SOL"(claimed + mev localStorage 求和)
 * 3 tab:
 *   1. 🎁 回收 SOL · 等 ⛓️ buildBatchCloseAccountTxs + 🗄️ /portfolio/empty-accounts ship 后接通(V1 占位)
 *   2. ⚡ MEV 返还 · 纯前端 localStorage(execute-swap-plan 自动记)
 *   3. 🎯 邀请返佣 · /invite 重定向占位
 *
 * tab 切换走 useSyncExternalStore 同步 URL hash(沿用 right-info-tabs V2 模式)
 */
import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { Recycle, Zap, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getClaimedTotalLamports,
  getMevTotalLamports,
} from '@/lib/rewards-storage';
import { ReclaimTab } from './reclaim-tab';
import { MevHistoryTab } from './mev-history-tab';
import { InviteRedirectTab } from './invite-redirect-tab';

type TabKey = 'reclaim' | 'mev' | 'invite';
const VALID_TABS: TabKey[] = ['reclaim', 'mev', 'invite'];

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHashTab = (): TabKey => {
  const h = window.location.hash.replace('#', '') as TabKey;
  return VALID_TABS.includes(h) ? h : 'reclaim';
};
const getServerTab = (): TabKey => 'reclaim';

export function RewardsScreen() {
  const t = useTranslations('rewards');
  const wallet = useWallet();
  const hashTab = useSyncExternalStore(subscribeHash, getHashTab, getServerTab);
  const [override, setOverride] = useState<TabKey | null>(null);
  const tab = override ?? hashTab;

  const addr = wallet.publicKey?.toBase58();

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
      </div>

      {/* 顶部 summary · 钱包地址 + 累计 */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('summary.wallet')}
            </div>
            <div className="font-mono text-xs">
              {addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : t('summary.notConnected')}
            </div>
          </div>
          <RewardsTotalDisplay />
        </CardContent>
      </Card>

      {/* 3 tab */}
      <Tabs value={tab} onValueChange={(v) => setOverride(v as TabKey)} className="w-full">
        <TabsList className="w-full justify-start">
          {/* T-REWARDS-POLISH:emoji 换 Lucide */}
          <TabsTrigger value="reclaim" data-testid="rewards-tab-reclaim">
            <Recycle className="h-3.5 w-3.5" />
            {t('tabs.reclaim')}
          </TabsTrigger>
          <TabsTrigger value="mev" data-testid="rewards-tab-mev">
            <Zap className="h-3.5 w-3.5" />
            {t('tabs.mev')}
          </TabsTrigger>
          <TabsTrigger value="invite" data-testid="rewards-tab-invite">
            <UserPlus className="h-3.5 w-3.5" />
            {t('tabs.invite')}
          </TabsTrigger>
        </TabsList>

        {/* keepMounted 让 3 panel 都在 DOM · 切 tab 不重 mount 子树 · 也方便 e2e 测 */}
        <TabsContent
          value="reclaim"
          keepMounted
          className="mt-4"
          data-testid="rewards-tab-reclaim-content"
        >
          <ReclaimTab />
        </TabsContent>
        <TabsContent
          value="mev"
          keepMounted
          className="mt-4"
          data-testid="rewards-tab-mev-content"
        >
          <MevHistoryTab />
        </TabsContent>
        <TabsContent
          value="invite"
          keepMounted
          className="mt-4"
          data-testid="rewards-tab-invite-content"
        >
          <InviteRedirectTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 累计回收(claimed + mev)显示 · 客户端 only · SSR 占位 */
const getServerZero = () => 0;
function RewardsTotalDisplay() {
  const t = useTranslations('rewards');
  // useSyncExternalStore 取 localStorage(getter 返 number · 引用稳定)
  const claimedLamports = useSyncExternalStore(
    subscribeStorage,
    getClaimedTotalLamports,
    getServerZero
  );
  const mevLamports = useSyncExternalStore(
    subscribeStorage,
    getMevTotalLamports,
    getServerZero
  );
  const totalSol = (claimedLamports + mevLamports) / 1e9;

  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {t('summary.totalRecovered')}
      </div>
      <div
        className="font-mono text-2xl font-semibold text-[var(--brand-up)]"
        data-testid="rewards-total-sol"
      >
        {totalSol.toFixed(4)} SOL
      </div>
    </div>
  );
}

const subscribeStorage = (cb: () => void) => {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
};
