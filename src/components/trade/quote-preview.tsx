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
import { AlertTriangle, ArrowDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

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
  /** T-925 #47:当前现货价(USD)— 用于弹窗"当前价"行 */
  currentPriceUsd?: number;
  /** T-925 #47:成交后此代币持仓估值(USD)— 用于弹窗"成交后估值"行 */
  postTradeValueUsd?: number;
}

interface Props {
  data: QuotePreviewData;
  /** 当前滑点 bps,给"一键拉滑点"用 */
  currentSlippageBps?: number;
  /** 应用推荐滑点的回调 */
  onApplySlippage?: (bps: number) => void;
  /** T-977e · 紧凑模式 · 1 行摘要 + 详情 Popover · 不撑开父容器 */
  compact?: boolean;
}

export function QuotePreview({ data, currentSlippageBps, onApplySlippage, compact }: Props) {
  const t = useTranslations();

  const currentBps = currentSlippageBps ?? 0;
  const currentPct = currentBps / 100;
  const showSlippageWarn =
    currentBps > 0 && data.priceImpactPct > currentPct * 0.5 + 0.1;
  const suggestedPct = Math.max(2, Math.ceil(data.priceImpactPct * 2));
  const suggestedBps = Math.min(suggestedPct * 100, 1000);

  const detailRows = (
    <div className="space-y-1.5">
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
      {/* T-925 #47:当前现货价 + 成交后预估持仓价值 */}
      {data.currentPriceUsd != null && data.currentPriceUsd > 0 && (
        <Row
          label={t('trade.preview.currentPrice')}
          value={`$${formatPriceUsd(data.currentPriceUsd)}`}
        />
      )}
      {data.postTradeValueUsd != null && data.postTradeValueUsd > 0 && (
        <Row
          label={t('trade.preview.postTradeValue')}
          value={`$${data.postTradeValueUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
        />
      )}
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
  );

  const slippageWarnBanner = showSlippageWarn && suggestedBps > currentBps && onApplySlippage ? (
    <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        {t('trade.preview.slippageWarn', {
          impact: data.priceImpactPct.toFixed(2),
          sol: data.payAmount.toFixed(3),
          loss: estimateLossUsd(data).toFixed(2),
          suggested: suggestedPct,
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
  ) : null;

  // T-977e · 紧凑模式: 1 行摘要 "支付 X → 预计收到 Y" + 详情 Popover
  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="rounded-md border bg-muted/30 p-2 flex items-center gap-1.5 text-[11px]">
          <span className="font-mono font-medium truncate">{data.payLabel}</span>
          <ArrowDown className="h-3 w-3 text-muted-foreground flex-shrink-0 -rotate-90" />
          <span className="font-mono font-medium truncate flex-1">{data.receiveLabel}</span>
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 rounded-md border border-primary/40 bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium hover:bg-primary/20 transition-colors flex-shrink-0"
                >
                  {t('trade.preview.detailsButton')}
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
              }
            />
            <PopoverContent className="w-64 text-xs">
              {detailRows}
            </PopoverContent>
          </Popover>
        </div>
        {slippageWarnBanner}
      </div>
    );
  }

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

      <div className="border-t pt-2">
        {detailRows}
      </div>

      {slippageWarnBanner}
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

/** T-925 #47:USD 单位价格,带亚美分位 / 千分位 */
function formatPriceUsd(n: number): string {
  if (!n) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toPrecision(3);
}

/** T-925 #51:估算"滑点损失"USD — payAmount 已是 SOL,priceImpactPct% 直接乘 */
function estimateLossUsd(data: QuotePreviewData): number {
  if (!data.currentPriceUsd) {
    // 无价格 fallback:用 SOL 数量 × 假设 $200/SOL × impactPct/100
    return data.payAmount * 200 * (data.priceImpactPct / 100);
  }
  // 用户付出 N SOL,impact% 损失 → N × solUsd × impact/100
  // payAmount 是 SOL 数(buy)或 token 数(sell),buy 路径下:
  // sol_lost = payAmount × impactPct / 100;转 USD 需要 SOL 价
  // 简化:直接用 payAmount × postTradeValue / receiveAmount × impactPct/100
  // 不再需要 SOL 价(已隐含在 receive 价值里)
  if (data.postTradeValueUsd && data.receiveAmount > 0) {
    return data.postTradeValueUsd * (data.priceImpactPct / 100);
  }
  return data.payAmount * 200 * (data.priceImpactPct / 100);
}
