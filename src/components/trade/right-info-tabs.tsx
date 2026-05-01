'use client';

/**
 * T-OKX-1B · 桌面右栏底部 3 tab(详情 / 开发者代币 / 同名代币)
 * T-MARKETS-DIFFER-V2(2026-04-30):加 risk tab(独立挂 6 项审计) · 监听 #risk hash 自动打开
 *
 * 默认 tab = 详情;URL hash 为 `#risk` 时初始 tab = risk(从 markets 页风险标 click 跳进来)
 * 仅 lg+ · 移动不显
 */
import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TokenInfo } from '@/lib/portfolio';
import { AuditCards } from './audit-cards';

interface Props {
  mint: string;
  detail: TokenInfo | null | undefined;
}

type TabKey = 'detail' | 'risk' | 'devTokens' | 'sameName';

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHashTab = (): TabKey =>
  window.location.hash === '#risk' ? 'risk' : 'detail';
const getServerTab = (): TabKey => 'detail';

export function RightInfoTabs({ mint, detail }: Props) {
  const t = useTranslations('trade.rightTabs');
  // useSyncExternalStore · React 19 推荐方式同步 URL hash · 不触发 setState-in-effect 警告
  const hashTab = useSyncExternalStore(subscribeHash, getHashTab, getServerTab);
  // 用户点 tab 切换时本地 override · 优先于 hash(避免 hash 锁死手动选择)
  const [override, setOverride] = useState<TabKey | null>(null);
  const tab = override ?? hashTab;
  const setTab = (v: TabKey) => setOverride(v);

  return (
    <Card>
      <CardContent className="p-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border/40 bg-transparent p-0 h-9">
            <TabsTrigger
              value="detail"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs h-9 px-3"
            >
              {t('detail')}
            </TabsTrigger>
            <TabsTrigger
              value="risk"
              data-testid="right-tab-risk"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs h-9 px-3"
            >
              {t('risk')}
            </TabsTrigger>
            <TabsTrigger
              value="devTokens"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs h-9 px-3"
            >
              {t('devTokens')}
            </TabsTrigger>
            <TabsTrigger
              value="sameName"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs h-9 px-3"
            >
              {t('sameName')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="p-3 space-y-2 text-xs">
            <DetailPanel mint={mint} detail={detail} />
          </TabsContent>

          <TabsContent value="risk" className="p-3 text-xs" data-testid="right-tab-risk-content">
            <AuditCards mint={mint} />
          </TabsContent>

          <TabsContent value="devTokens" className="p-4 text-xs text-muted-foreground/60 text-center">
            {t('devTokensPending')}
          </TabsContent>

          <TabsContent value="sameName" className="p-4 text-xs text-muted-foreground/60 text-center">
            {t('sameNamePending')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DetailPanel({ mint, detail }: { mint: string; detail: TokenInfo | null | undefined }) {
  const t = useTranslations('trade.rightTabs');

  if (!mint) {
    return <div className="text-muted-foreground/60 text-center py-2">{t('noMint')}</div>;
  }

  if (detail === undefined) {
    return (
      <div className="space-y-1.5">
        <div className="h-3 w-3/4 bg-muted/40 animate-pulse rounded" />
        <div className="h-3 w-full bg-muted/40 animate-pulse rounded" />
        <div className="h-3 w-2/3 bg-muted/40 animate-pulse rounded" />
      </div>
    );
  }

  const description = (detail as unknown as { description?: string })?.description;
  const deployedFrom = detail?.topPoolAddress;

  return (
    <div className="space-y-2">
      {/* description (可能 backend 不返,占位 muted) */}
      <div className="space-y-0.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {t('description')}
        </div>
        <div className="text-xs leading-relaxed">
          {description || <span className="text-muted-foreground/60">{t('descriptionPending')}</span>}
        </div>
      </div>

      {/* 部署源(top pool) */}
      {deployedFrom && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {t('deployedFrom')}
          </div>
          <div className="font-mono text-[10px] truncate text-muted-foreground" title={deployedFrom}>
            {deployedFrom.slice(0, 8)}…{deployedFrom.slice(-6)}
          </div>
        </div>
      )}

      {/* T-OKX-1C-fe · 6 项审计卡(后端 /token/audit-card a668538) */}
      <div className="pt-1.5 border-t border-border/40">
        <AuditCards mint={mint} />
      </div>
    </div>
  );
}
