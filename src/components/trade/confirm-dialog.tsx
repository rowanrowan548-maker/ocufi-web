'use client';

/**
 * 交易确认弹窗
 *
 * 安全护栏(渐进式):
 *  - 普通(< 1 SOL):直接确认
 *  - 大额(>= 1 SOL):底部加金额警示条,确认按钮 2 秒倒计时禁用避免手抖
 *  - 高风险代币(highRisk=true):顶部红色警告条,默认勾上"我知晓",未勾选不能确认
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, AlertOctagon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QuotePreview, type QuotePreviewData } from './quote-preview';

const LARGE_AMOUNT_THRESHOLD_SOL = 1;
const LARGE_HOLD_SEC = 2; // 大额倒计时秒数

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: 'buy' | 'sell';
  data: QuotePreviewData | null;
  symbol?: string;
  onConfirm: () => void;
  confirming?: boolean;
  /** 输入端 SOL 金额(用于大额判定);买入是 inputSol,卖出是预计 outSol */
  solAmount?: number;
  /** 高风险代币:high / critical 时传 true,弹"我知晓"勾选 */
  highRisk?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  kind,
  data,
  symbol,
  onConfirm,
  confirming,
  solAmount,
  highRisk,
}: Props) {
  const t = useTranslations();

  // 大额倒计时
  const isLargeAmount = (solAmount ?? 0) >= LARGE_AMOUNT_THRESHOLD_SOL;
  const [holdLeft, setHoldLeft] = useState(0);

  useEffect(() => {
    if (!open) {
      setHoldLeft(0);
      return;
    }
    if (!isLargeAmount) {
      setHoldLeft(0);
      return;
    }
    setHoldLeft(LARGE_HOLD_SEC);
    const id = setInterval(() => {
      setHoldLeft((n) => {
        if (n <= 1) { clearInterval(id); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, isLargeAmount]);

  // 高风险:必须勾选"我知晓"
  const [acked, setAcked] = useState(false);
  useEffect(() => {
    if (!open) setAcked(false);
  }, [open]);

  if (!data) return null;

  const buttonDisabled =
    confirming ||
    (isLargeAmount && holdLeft > 0) ||
    (highRisk && !acked);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {kind === 'buy'
              ? t('trade.confirm.buyTitle', { symbol: symbol ?? '' })
              : t('trade.confirm.sellTitle', { symbol: symbol ?? '' })}
          </DialogTitle>
          <DialogDescription>{t('trade.confirm.notice')}</DialogDescription>
        </DialogHeader>

        {/* 高风险警告 · 顶部红条 */}
        {highRisk && (
          <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-xs space-y-2">
            <div className="flex items-start gap-2 text-danger font-medium">
              <AlertOctagon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>{t('trade.confirm.highRisk.title')}</div>
            </div>
            <div className="text-muted-foreground pl-6">
              {t('trade.confirm.highRisk.desc')}
            </div>
            <label className="flex items-center gap-2 pl-6 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acked}
                onChange={(e) => setAcked(e.target.checked)}
                className="accent-danger"
              />
              <span className="text-foreground">{t('trade.confirm.highRisk.ack')}</span>
            </label>
          </div>
        )}

        <div className="py-1">
          <QuotePreview data={data} />
        </div>

        {/* 大额提示 */}
        {isLargeAmount && (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-warning">
                {t('trade.confirm.large.title', { amount: (solAmount ?? 0).toFixed(2) })}
              </div>
              <div className="text-muted-foreground mt-0.5">
                {t('trade.confirm.large.desc')}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            className="flex-1 sm:flex-none"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={buttonDisabled}
            className={`flex-1 sm:flex-none ${kind === 'sell' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
          >
            {confirming
              ? t('trade.buttons.signing')
              : isLargeAmount && holdLeft > 0
              ? `${t('common.confirm')} (${holdLeft})`
              : t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
