'use client';

/**
 * 交易确认弹窗
 *
 * 安全护栏(渐进式):
 *  - 普通(< 1 SOL):直接确认
 *  - 大额(>= 1 SOL):底部加金额警示条,确认按钮 2 秒倒计时禁用避免手抖
 *  - 高风险(risk=high/critical/unknown):顶部红色警告条 + 风险原因列表 + "我已知晓"勾选,
 *    unknown 也强制勾选(数据不可用就不静默放行)
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { AlertTriangle, AlertOctagon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QuotePreview, type QuotePreviewData } from './quote-preview';
import type { OverallRisk, RiskReason } from '@/lib/token-info';
import { markSkipFor24h } from '@/lib/buy-prefs-store';

const LARGE_AMOUNT_THRESHOLD_SOL = 1;
const LARGE_HOLD_SEC = 2;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: 'buy' | 'sell';
  data: QuotePreviewData | null;
  symbol?: string;
  /** T-925 #46:代币全名 (e.g. "Official Trump") */
  tokenName?: string;
  /** T-925 #46:logo URI */
  tokenLogoUri?: string;
  /** T-925 #46:完整 mint,显示在副标题(标"合约地址") */
  mintAddr?: string;
  onConfirm: () => void;
  confirming?: boolean;
  /** 输入端 SOL 金额(用于大额判定);买入是 inputSol,卖出是预计 outSol */
  solAmount?: number;
  /** 风险等级 · high/critical/unknown 时弹"我已知晓"勾选 */
  risk?: OverallRisk;
  /** 具体风险原因列表(由上层 riskReasons() 算出),展示在红弹窗里 */
  reasons?: RiskReason[];
}

const ACK_REQUIRED: ReadonlySet<OverallRisk> = new Set<OverallRisk>(['high', 'critical', 'unknown']);

export function ConfirmDialog({
  open,
  onOpenChange,
  kind,
  data,
  symbol,
  tokenName,
  tokenLogoUri,
  mintAddr,
  onConfirm,
  confirming,
  solAmount,
  risk,
  reasons,
}: Props) {
  const t = useTranslations();

  const isLargeAmount = (solAmount ?? 0) >= LARGE_AMOUNT_THRESHOLD_SOL;
  const [holdLeft, setHoldLeft] = useState(0);

  useEffect(() => {
    if (!open || !isLargeAmount) {
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

  const ackRequired = !!risk && ACK_REQUIRED.has(risk);
  const [acked, setAcked] = useState(false);
  // T-925 #48:"下次跳过(24h)"复选框
  const [dontShow, setDontShow] = useState(false);
  useEffect(() => {
    if (!open) {
      setAcked(false);
      setDontShow(false);
    }
  }, [open]);

  if (!data) return null;

  const buttonDisabled =
    confirming ||
    (isLargeAmount && holdLeft > 0) ||
    (ackRequired && !acked);

  // critical 用更刺眼的红框,unknown / high 用警告色但克制
  const isCritical = risk === 'critical';
  const warnTitleKey =
    risk === 'critical' ? 'trade.confirm.highRisk.titleCritical'
      : risk === 'unknown' ? 'trade.confirm.highRisk.titleUnknown'
        : 'trade.confirm.highRisk.title';
  const warnDescKey =
    risk === 'unknown' ? 'trade.confirm.highRisk.descUnknown'
      : 'trade.confirm.highRisk.desc';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* T-925 #46:头部 — logo + ticker · name + mint subtitle(防钓鱼) */}
        <DialogHeader>
          <div className="flex items-center gap-3">
            {tokenLogoUri ? (
              <Image
                src={tokenLogoUri}
                alt={symbol ?? ''}
                width={40}
                height={40}
                className="rounded-full bg-muted flex-shrink-0"
                unoptimized
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-bold text-muted-foreground">
                {(symbol ?? '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold tracking-tight truncate">
                {kind === 'buy' ? t('trade.confirm.buyTitle', { symbol: symbol ?? '' })
                  : t('trade.confirm.sellTitle', { symbol: symbol ?? '' })}
              </div>
              {tokenName && tokenName !== symbol && (
                <div className="text-xs text-muted-foreground truncate">{tokenName}</div>
              )}
            </div>
          </div>
          {mintAddr && (
            <div className="text-[10px] text-muted-foreground/70 font-mono pt-1">
              {t('trade.confirm.mintLabel')}: {mintAddr.slice(0, 8)}…{mintAddr.slice(-6)}
            </div>
          )}
          <div className="text-xs text-muted-foreground pt-1">
            {t('trade.confirm.notice')}
          </div>
        </DialogHeader>

        {/* 高风险 / 未知风险 警告条 */}
        {ackRequired && (
          <div className={`rounded-md border p-3 text-xs space-y-2 ${
            isCritical
              ? 'border-danger/60 bg-danger/15'
              : 'border-danger/40 bg-danger/10'
          }`}>
            <div className="flex items-start gap-2 text-danger font-medium">
              <AlertOctagon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>{t(warnTitleKey)}</div>
            </div>
            <div className="text-muted-foreground pl-6">
              {t(warnDescKey)}
            </div>

            {/* 具体原因列表(每条一行,前面用圆点;最多展示 5 条) */}
            {reasons && reasons.length > 0 && (
              <ul className="pl-6 space-y-1 list-disc list-inside marker:text-danger/60">
                {reasons.slice(0, 5).map((r) => (
                  <li key={r.code} className="text-foreground">
                    {tReason(t, r)}
                  </li>
                ))}
              </ul>
            )}

            <label className="flex items-center gap-2 pl-6 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={acked}
                onChange={(e) => setAcked(e.target.checked)}
                className="accent-danger"
              />
              <span className="text-foreground">
                {t(risk === 'unknown' ? 'trade.confirm.highRisk.ackUnknown' : 'trade.confirm.highRisk.ack')}
              </span>
            </label>
          </div>
        )}

        <div className="py-1">
          <QuotePreview data={data} />
        </div>

        {/* T-925 #48:下次跳过(24h)— 仅 buy 路径有意义,sell 风险低不显示 */}
        {kind === 'buy' && !ackRequired && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="accent-primary"
            />
            <span>{t('trade.confirm.dontShow24h')}</span>
          </label>
        )}

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

        <DialogFooter className="!flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            className="flex-1 h-11 sm:h-9 sm:flex-none"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (dontShow) markSkipFor24h();
              onConfirm();
            }}
            disabled={buttonDisabled}
            className={`flex-1 h-11 sm:h-9 sm:flex-none ${kind === 'sell' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
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

/** 把 RiskReason 翻译成展示文案 */
function tReason(t: ReturnType<typeof useTranslations>, r: RiskReason): string {
  const key = `trade.confirm.highRisk.reasons.${r.code}`;
  return t(key);
}
