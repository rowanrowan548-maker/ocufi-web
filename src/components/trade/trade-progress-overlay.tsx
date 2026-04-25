'use client';

/**
 * 交易进度蒙层 · 全屏 4 步可视化
 *
 * 步骤:签名 → 广播 → 确认 → 完成
 * 30s 提示"网络拥堵中,稍等";60s 提示"超时建议升级优先费重试"
 *
 * 不可关闭(用户在签名/上链途中关掉容易困惑),tx 在后台继续跑,
 * 完成后由父组件切 stage 关掉蒙层
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2, Loader2, PenTool, Send, Hourglass, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';

export type ProgressStage =
  | 'idle' | 'quoting' | 'quoted'
  | 'signing' | 'sending' | 'confirming'
  | 'done' | 'error';

interface Props {
  open: boolean;
  stage: ProgressStage;
  /** 上链后才有的 signature */
  signature?: string;
  /** Solscan/Solana Explorer base */
  explorer?: string;
  /** stage 进入 signing 的时间戳,用来算 elapsed */
  startedAt?: number;
}

export function TradeProgressOverlay({ open, stage, signature, explorer, startedAt }: Props) {
  const t = useTranslations('trade.progress');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open || !startedAt) {
      setElapsed(0);
      return;
    }
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [open, startedAt]);

  if (!open) return null;

  const steps: Array<{ key: ProgressStage; Icon: typeof PenTool; label: string }> = [
    { key: 'signing', Icon: PenTool, label: t('signing') },
    { key: 'sending', Icon: Send, label: t('sending') },
    { key: 'confirming', Icon: Hourglass, label: t('confirming') },
  ];
  const stageIndex = steps.findIndex((s) => s.key === stage);

  // 30s+ 提示拥堵;60s+ 强烈提示
  const showSlow = elapsed >= 30 && stage === 'confirming';
  const showVerySlow = elapsed >= 60 && stage === 'confirming';

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div>
          <div className="text-base font-semibold">{t('title')}</div>
          <div className="text-xs text-muted-foreground mt-1">{t('subtitle')}</div>
        </div>

        <div className="space-y-2">
          {steps.map((step, i) => {
            const done = i < stageIndex;
            const active = i === stageIndex;
            const pending = i > stageIndex;
            return (
              <div
                key={step.key}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors',
                  active ? 'bg-primary/10 border border-primary/30' : '',
                  done ? 'opacity-90' : '',
                  pending ? 'opacity-40' : '',
                ].join(' ')}
              >
                <div
                  className={[
                    'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0',
                    done
                      ? 'bg-success/20 text-success'
                      : active
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : active ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <step.Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{step.label}</div>
                  {active && elapsed > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{elapsed}s</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {showSlow && (
          <div className="flex gap-2 p-3 rounded-md bg-warning/10 text-warning border border-warning/20 text-xs">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>{showVerySlow ? t('timeoutSlow') : t('timeoutWarning')}</div>
          </div>
        )}

        {signature && explorer && (stage === 'sending' || stage === 'confirming') && (
          <a
            href={`${explorer}/tx/${signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-primary hover:underline pt-1"
          >
            <ExternalLink className="h-3 w-3" />
            {t('viewTx')}
          </a>
        )}
      </Card>
    </div>
  );
}
