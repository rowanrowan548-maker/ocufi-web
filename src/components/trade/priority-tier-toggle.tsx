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

const TIERS: { value: PriorityTier; labelKey: string; tooltipKey: string; sol: string }[] = [
  { value: 'pilot', labelKey: 'trade.priority.pilot', tooltipKey: 'trade.priority.tooltip.pilot', sol: '0.000005' },
  { value: 'p1', labelKey: 'trade.priority.p1', tooltipKey: 'trade.priority.tooltip.p1', sol: '0.00005' },
  { value: 'p2', labelKey: 'trade.priority.p2', tooltipKey: 'trade.priority.tooltip.p2', sol: '0.0005' },
  { value: 'p3', labelKey: 'trade.priority.p3', tooltipKey: 'trade.priority.tooltip.p3', sol: '0.005' },
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
          // T-PRIORITY-TOOLTIP · 删按钮内 0.00005 数字 · hover/focus 显 tooltip
          // 用 native title 兜底无障碍 + 自有 group-hover/focus tooltip 视觉
          const tip = t(tier.tooltipKey, { sol: tier.sol });
          return (
            <div key={tier.value} className="relative group">
              <button
                type="button"
                onClick={() => onChange(tier.value)}
                aria-pressed={active}
                title={tip}
                className={`w-full px-2 py-2 rounded text-xs font-medium transition-colors leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {t(tier.labelKey)}
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 whitespace-nowrap rounded border border-border/60 bg-popover px-2 py-1 text-[10px] font-mono text-foreground shadow-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
              >
                {tip}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
