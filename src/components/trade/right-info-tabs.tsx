'use client';

/**
 * T-OKX-1B · 桌面右栏底部 3 tab(详情 / 开发者代币 / 同名代币)
 *
 * 默认 tab = 详情(description + 部署源 + 6 项审计卡占位 · T-OKX-1C-fe 接后端后填实)
 * 仅 lg+ · 移动不显
 */
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TokenInfo } from '@/lib/portfolio';
import { AuditCards } from './audit-cards';

interface Props {
  mint: string;
  detail: TokenInfo | null | undefined;
}

export function RightInfoTabs({ mint, detail }: Props) {
  const t = useTranslations('trade.rightTabs');

  return (
    <Card>
      <CardContent className="p-0">
        <Tabs defaultValue="detail" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border/40 bg-transparent p-0 h-9">
            <TabsTrigger
              value="detail"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs h-9 px-3"
            >
              {t('detail')}
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
