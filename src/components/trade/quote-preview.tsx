'use client';

/**
 * 交易报价预览
 *
 * 展示项:
 *  - 支付 / 收到 / 最低到账(滑点底)
 *  - 价格冲击
 *  - Ocufi 平台手续费(0.1%,仅买入)
 *  - Solana 网络 Gas 估算
 *  - 滑点超阈警告 + 一键拉
 */
import { AlertTriangle, ArrowDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface QuotePreviewData {
  payAmount: number;
  payLabel: string;            // "0.01 SOL" 或 "1,234 TOKEN"
  receiveAmount: number;
  receiveLabel: string;
  minReceiveAmount: number;
  minReceiveLabel: string;
  priceImpactPct: number;      // 百分比值 0.123 = 0.123%
  /** Ocufi 平台手续费(SOL),买入 = inputSol × 0.1%;卖出 = 0 */
  platformFeeSol?: number;
  /** Solana 网络 Gas 估算上限(SOL) */
  networkFeeMaxSol?: number;
}

interface Props {
  data: QuotePreviewData;
  /** 当前滑点 bps,给"一键拉滑点"用 */
  currentSlippageBps?: number;
  /** 应用推荐滑点的回调 */
  onApplySlippage?: (bps: number) => void;
}

export function QuotePreview({ data, currentSlippageBps, onApplySlippage }: Props) {
  const t = useTranslations();

  const currentBps = currentSlippageBps ?? 0;
  const currentPct = currentBps / 100;
  const showSlippageWarn =
    currentBps > 0 && data.priceImpactPct > currentPct * 0.5 + 0.1;
  const suggestedPct = Math.max(2, Math.ceil(data.priceImpactPct * 2));
  const suggestedBps = Math.min(suggestedPct * 100, 1000);

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

      <div className="border-t pt-2 space-y-1.5">
        <Row
          label={t('trade.preview.minReceive')}
          value={data.minReceiveLabel}
          tooltip={t('trade.preview.minReceiveTooltip', { pct: currentPct.toFixed(2) })}
        />
        <Row
          label={t('trade.preview.priceImpact')}
          value={`${data.priceImpactPct.toFixed(3)}%`}
          valueClassName={data.priceImpactPct > 5 ? 'text-destructive font-medium' : ''}
        />
        <Row
          label={t('trade.preview.platformFee')}
          value={
            data.platformFeeSol != null && data.platformFeeSol > 0
              ? `${data.platformFeeSol.toFixed(6)} SOL`
              : t('trade.preview.platformFeeNone')
          }
          tooltip={t('trade.preview.platformFeeTooltip')}
        />
        <Row
          label={t('trade.preview.networkFee')}
          value={
            data.networkFeeMaxSol != null
              ? `≤ ${data.networkFeeMaxSol.toFixed(6)} SOL`
              : '—'
          }
          tooltip={t('trade.preview.networkFeeTooltip')}
        />
      </div>

      {showSlippageWarn && suggestedBps > currentBps && onApplySlippage && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            {t('trade.preview.slippageWarn', {
              impact: data.priceImpactPct.toFixed(2),
              current: (currentBps / 100).toFixed(1),
            })}
          </div>
          <button
            type="button"
            onClick={() => onApplySlippage(suggestedBps)}
            className="font-medium underline underline-offset-2 hover:no-underline flex-shrink-0"
          >
            {t('trade.preview.slippageApply', { bps: suggestedPct })}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  label, value, valueClassName, tooltip,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex justify-between text-xs text-muted-foreground" title={tooltip}>
      <span>{label}</span>
      <span className={`font-mono ${valueClassName ?? ''}`}>{value}</span>
    </div>
  );
}

export function formatAmount(n: number): string {
  if (!n && n !== 0) return '—';
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}
