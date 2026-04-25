'use client';

/**
 * 优先费档位选择器 · 三档动态显示 SOL 数值 + ETA + 当前网络拥堵状态
 *
 * 数据来源:RPC `getRecentPrioritizationFees`,30s 自动刷新
 * 失败时:走 i18n 静态文案 fallback,不影响用户操作
 */
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { type GasLevel } from '@/lib/jupiter';
import { formatPriorityFeeSol } from '@/lib/priority-fees';
import { usePriorityFees } from '@/hooks/use-priority-fees';

interface Props {
  value: GasLevel;
  onChange: (v: GasLevel) => void;
  id?: string;
}

const ETA_BY_LEVEL: Record<GasLevel, string> = {
  normal: '10-30s',
  fast: '3-10s',
  turbo: '<3s',
};

export function GasSelect({ value, onChange, id }: Props) {
  const t = useTranslations();
  const fees = usePriorityFees();

  const desc = (g: GasLevel): string => {
    if (!fees) return t(`trade.gas.${g}Desc`);
    const sol = g === 'normal' ? fees.normalSol : g === 'fast' ? fees.fastSol : fees.turboSol;
    return `${formatPriorityFeeSol(sol)} SOL · ${ETA_BY_LEVEL[g]}`;
  };

  const congestionTone = fees
    ? fees.congestion === 'busy' ? 'text-warning'
      : fees.congestion === 'idle' ? 'text-success'
        : 'text-muted-foreground'
    : 'text-muted-foreground';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{t('trade.fields.gas')}</Label>
        {fees && (
          <span className={`text-[10px] font-mono ${congestionTone}`}>
            {t(`trade.gas.congestion.${fees.congestion}`)}
          </span>
        )}
      </div>

      <Select value={value} onValueChange={(v) => onChange(v as GasLevel)}>
        <SelectTrigger id={id}>{t(`trade.gas.${value}`)}</SelectTrigger>
        <SelectContent>
          {(['normal', 'fast', 'turbo'] as GasLevel[]).map((g) => (
            <SelectItem key={g} value={g}>
              <div className="flex flex-col items-start">
                <span className="text-sm">{t(`trade.gas.${g}`)}</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {desc(g)}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {fees?.congestion === 'busy' && (
        <div className="text-[10px] text-warning flex items-start gap-1">
          <AlertCircle className="h-3 w-3 mt-px flex-shrink-0" />
          <span>{t('trade.gas.congestionHint')}</span>
        </div>
      )}
    </div>
  );
}
