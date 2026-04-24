'use client';

/**
 * 交易确认弹窗
 * 买入/卖出按"确认"后先弹这个,二次确认再签名
 */
import { useTranslations } from 'next-intl';
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: 'buy' | 'sell';
  data: QuotePreviewData | null;
  symbol?: string;
  onConfirm: () => void;
  confirming?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  kind,
  data,
  symbol,
  onConfirm,
  confirming,
}: Props) {
  const t = useTranslations();
  if (!data) return null;

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

        <div className="py-2">
          <QuotePreview data={data} />
        </div>

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
            disabled={confirming}
            className="flex-1 sm:flex-none"
          >
            {confirming ? t('trade.buttons.signing') : t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
