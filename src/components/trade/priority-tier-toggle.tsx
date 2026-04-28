'use client';

/**
 * T-985d · 4 档优先费 ToggleGroup(Pilot / P1 / P2 / P3)
 *
 * 桌面 desktop (compact=false) 模式专用 · 替代单档 GasSelect
 * 视图层用 PriorityTier · 通过 toGasLevel 映射回 jupiter.ts 已支持的 3 档(normal/fast/turbo)
 *   - pilot → normal(5K lamports)
 *   - p1    → fast(50K · 默认)
 *   - p2    → turbo(1M)
 *   - p3    → turbo(1M · 链上 ⛓️ 后续升级 jupiter 4 档时改 5M)
 */
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import type { GasLevel } from '@/lib/jupiter';
import type { PriorityTier } from '@/lib/priority-fees';
import { DocsHelpIcon } from '@/components/docs/docs-help-icon';

interface Props {
  value: PriorityTier;
  onChange: (v: PriorityTier) => void;
  id?: string;
}

export const PRIORITY_TIER_TO_GAS_LEVEL: Record<PriorityTier, GasLevel> = {
  pilot: 'normal',
  p1: 'fast',
  p2: 'turbo',
  p3: 'turbo',
};

const TIERS: { value: PriorityTier; labelKey: string; sol: string }[] = [
  { value: 'pilot', labelKey: 'trade.priority.pilot', sol: '0.000005' },
  { value: 'p1', labelKey: 'trade.priority.p1', sol: '0.00005' },
  { value: 'p2', labelKey: 'trade.priority.p2', sol: '0.0005' },
  { value: 'p3', labelKey: 'trade.priority.p3', sol: '0.005' },
];

export function PriorityTierToggle({ value, onChange, id }: Props) {
  const t = useTranslations();
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="inline-flex items-center gap-1">
        {t('trade.fields.priority')}
        <DocsHelpIcon target="adv-priority-fee" label={t('trade.fields.priorityHelp')} />
      </Label>
      <div id={id} className="grid grid-cols-4 gap-1 rounded-md border border-border/40 bg-muted/20 p-0.5">
        {TIERS.map((tier) => {
          const active = value === tier.value;
          return (
            <button
              key={tier.value}
              type="button"
              onClick={() => onChange(tier.value)}
              aria-pressed={active}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors flex flex-col items-center gap-0 leading-tight ${
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <span>{t(tier.labelKey)}</span>
              <span className={`text-[9px] font-mono tabular-nums ${active ? 'opacity-80' : 'text-muted-foreground/60'}`}>
                {tier.sol}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
