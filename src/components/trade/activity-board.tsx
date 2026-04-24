'use client';

/**
 * 交易活动面板(占位)
 * gmgn 风:tabs 切换 活动 / 订单 / 持有者 / 交易者 / 流动性池 / 风险明细
 *
 * V1 大部分是空状态,Day 13+ 接入真实数据:
 *  - 活动:链上 swap/transfer 流(用 Helius webhook 或轮询 getSignaturesForAddress)
 *  - 订单:用户对此币的限价单(/limit 已经能拿)
 *  - 持有者:RugCheck topHolders(detail.topHolders 已经有)
 *  - 风险明细:detail.risks 已经有
 */
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, ListOrdered, Users, AlertTriangle, Wallet, Construction } from 'lucide-react';
import type { TokenDetail } from '@/lib/token-info';

interface Props {
  detail: TokenDetail | null;
}

export function ActivityBoard({ detail }: Props) {
  const t = useTranslations('trade.activity');
  const [tab, setTab] = useState('activity');

  return (
    <Card className="p-4">
      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList className="bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-5 px-0 mb-4 h-auto overflow-x-auto">
          <TabBtn value="activity" Icon={Activity}>{t('activity')}</TabBtn>
          <TabBtn value="orders" Icon={ListOrdered}>{t('orders')}</TabBtn>
          <TabBtn value="holders" Icon={Users}>
            {t('holders')}{detail?.totalHolders ? ` ${detail.totalHolders.toLocaleString()}` : ''}
          </TabBtn>
          <TabBtn value="risks" Icon={AlertTriangle}>
            {t('risks')}{detail?.risks?.length ? ` ${detail.risks.length}` : ''}
          </TabBtn>
        </TabsList>

        <TabsContent value="activity">
          <Empty Icon={Construction} title={t('comingSoon.activity.title')} subtitle={t('comingSoon.activity.subtitle')} />
        </TabsContent>

        <TabsContent value="orders">
          <Empty Icon={Wallet} title={t('comingSoon.orders.title')} subtitle={t('comingSoon.orders.subtitle')} />
        </TabsContent>

        <TabsContent value="holders">
          {detail?.topHolders && detail.topHolders.length > 0 ? (
            <div className="space-y-2 text-xs">
              {detail.topHolders.slice(0, 10).map((h, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border/30 last:border-b-0">
                  <span className="font-mono text-muted-foreground">
                    #{i + 1} {h.address ? `${h.address.slice(0, 4)}…${h.address.slice(-4)}` : '—'}
                  </span>
                  <span className="font-mono">{(h.pct ?? 0).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty Icon={Users} title={t('comingSoon.holders.title')} subtitle={t('comingSoon.holders.subtitle')} />
          )}
        </TabsContent>

        <TabsContent value="risks">
          {detail?.risks && detail.risks.length > 0 ? (
            <div className="space-y-2">
              {detail.risks.map((r, i) => (
                <div
                  key={i}
                  className={[
                    'flex gap-2 p-2.5 rounded-md text-xs',
                    r.level === 'danger'
                      ? 'bg-danger/10 text-danger border border-danger/20'
                      : r.level === 'warn'
                      ? 'bg-warning/10 text-warning border border-warning/20'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{r.name}</div>
                    {r.description && <div className="text-[11px] mt-0.5 opacity-80">{r.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty Icon={AlertTriangle} title={t('noRisks.title')} subtitle={t('noRisks.subtitle')} />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function TabBtn({ value, Icon, children }: { value: string; Icon: typeof Activity; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground gap-1.5"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs whitespace-nowrap">{children}</span>
    </TabsTrigger>
  );
}

function Empty({ Icon, title, subtitle }: { Icon: typeof Activity; title: string; subtitle: string }) {
  return (
    <div className="py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="text-xs text-muted-foreground/60 mt-1">{subtitle}</div>
    </div>
  );
}
