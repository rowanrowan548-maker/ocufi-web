'use client';

/**
 * 限价单预览卡(BUG-037)
 *
 * 与 QuotePreview 视觉一致(rounded-lg border bg-muted/30 p-4 + Row 横排),
 * 字段适配限价单语义:
 *  - 支付 / 目标价 / 预计成交
 *  - 当前市价 + 价格差(目标 vs 市价 ·  买:负=折扣;卖:正=溢价)
 *  - Jupiter 限价费 0.2%(由 Jupiter Trigger API 收 · 跟 Ocufi 0.1% 平台费分开)
 *  - 最小订单 $5 USD 估值 hint
 */
import { useTranslations } from 'next-intl';
import { ArrowDown, AlertTriangle } from 'lucide-react';
import { formatAmount } from '@/components/trade/quote-preview';

interface Props {
  side: 'buy' | 'sell';
  symbol: string;            // token symbol(显示)
  amount: number;            // 输入 SOL 数(buy)或 token 数(sell)
  targetPrice: number;       // SOL/枚
  estimated: number;         // 买:tokens / 卖:SOL
  marketPrice?: number | null;   // 当前 SOL/枚 市价
  orderUsdValue?: number | null; // 估算 USD 价值($5 USD 阈值判断)
}

const JUPITER_LIMIT_FEE_PCT = 0.2;
const MIN_ORDER_USD = 5;

export function LimitPreview({
  side,
  symbol,
  amount,
  targetPrice,
  estimated,
  marketPrice,
  orderUsdValue,
}: Props) {
  const t = useTranslations('trade.preview');

  const payLabel = side === 'buy'
    ? `${formatAmount(amount)} SOL`
    : `${formatAmount(amount)} ${symbol || 'TOKEN'}`;
  const targetPriceLabel = `${formatAmount(targetPrice)} SOL/${symbol || 'TOKEN'}`;
  const estimatedLabel = side === 'buy'
    ? `${formatAmount(estimated)} ${symbol || 'TOKEN'}`
    : `${formatAmount(estimated)} SOL`;

  // 价格差:(target - market) / market × 100
  // buy:negative = 折扣买入(好);positive = 溢价买入(可能永远不成交)
  // sell:positive = 溢价卖出(好);negative = 折扣卖出(可能永远不成交)
  const priceDiffPct =
    marketPrice != null && marketPrice > 0
      ? ((targetPrice - marketPrice) / marketPrice) * 100
      : null;
  const diffFavorable =
    priceDiffPct != null
      ? side === 'buy'
        ? priceDiffPct < 0
        : priceDiffPct > 0
      : false;
  const diffColor =
    priceDiffPct == null
      ? ''
      : diffFavorable
      ? 'text-success'
      : Math.abs(priceDiffPct) > 50
      ? 'text-warning'
      : 'text-muted-foreground';

  const tooSmall =
    orderUsdValue != null && orderUsdValue > 0 && orderUsdValue < MIN_ORDER_USD;

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
      <div className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
        {t('limitOrderTitle')}
      </div>

      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('pay')}</span>
        <span className="font-mono font-medium">{payLabel}</span>
      </div>
      <div className="flex justify-center">
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('limitOrderEstimatedFill')}</span>
        <span className="font-mono font-medium">{estimatedLabel}</span>
      </div>

      <div className="border-t pt-2 space-y-1.5">
        <Row
          label={t('limitOrderTargetPrice')}
          value={targetPriceLabel}
        />
        {marketPrice != null && marketPrice > 0 && (
          <Row
            label={t('limitOrderCurrentPrice')}
            value={`${formatAmount(marketPrice)} SOL/${symbol || 'TOKEN'}`}
          />
        )}
        {priceDiffPct != null && (
          <Row
            label={t('limitOrderPriceDiff')}
            value={`${priceDiffPct > 0 ? '+' : ''}${priceDiffPct.toFixed(2)}%`}
            valueClassName={diffColor}
          />
        )}
        <Row
          label={t('limitOrderJupiterFee')}
          value={`${JUPITER_LIMIT_FEE_PCT}%`}
        />
      </div>

      {tooSmall && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{t('limitOrderMinHint', { value: orderUsdValue!.toFixed(2) })}</span>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span className={`font-mono ${valueClassName ?? ''}`}>{value}</span>
    </div>
  );
}

export function LimitPreviewPlaceholder() {
  const t = useTranslations('trade.preview');
  return (
    <div className="rounded-lg border border-dashed bg-muted/10 p-4 text-xs text-muted-foreground/70 text-center">
      {t('limitOrderPlaceholder')}
    </div>
  );
}
