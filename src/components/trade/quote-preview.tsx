'use client';

/**
 * 交易报价预览组件
 * 买入/卖出共用。显示支付/收到/最低到账/价格冲击/手续费。
 */
import { ArrowDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getConfiguredPlatformFeeBps } from '@/lib/jupiter';

export interface QuotePreviewData {
  payAmount: number;
  payLabel: string;            // "0.01 SOL" 或 "1,234 TOKEN"
  receiveAmount: number;
  receiveLabel: string;
  minReceiveAmount: number;
  minReceiveLabel: string;
  priceImpactPct: number;      // 百分比值 0.123 = 0.123%
}

export function QuotePreview({ data }: { data: QuotePreviewData }) {
  const t = useTranslations();
  const feeBps = getConfiguredPlatformFeeBps();

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('trade.preview.pay')}</span>
        <span className="font-mono font-medium">{data.payLabel}</span>
      </div>
      <div className="flex justify-center">
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('trade.preview.receive')}</span>
        <span className="font-mono font-medium">{data.receiveLabel}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
        <span>{t('trade.preview.minReceive')}</span>
        <span className="font-mono">{data.minReceiveLabel}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t('trade.preview.priceImpact')}</span>
        <span className={data.priceImpactPct > 5 ? 'text-destructive font-medium' : ''}>
          {data.priceImpactPct.toFixed(3)}%
        </span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t('trade.preview.platformFee')}</span>
        <span>
          {feeBps > 0 ? `${(feeBps / 100).toFixed(2)}%` : t('trade.preview.platformFeeNone')}
        </span>
      </div>
    </div>
  );
}

export function formatAmount(n: number): string {
  if (!n && n !== 0) return '—';
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}
