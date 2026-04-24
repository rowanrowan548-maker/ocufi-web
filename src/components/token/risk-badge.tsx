import { Shield, AlertTriangle, AlertOctagon, HelpCircle, CheckCircle2 } from 'lucide-react';
import type { OverallRisk } from '@/lib/token-info';

interface Props {
  level: OverallRisk;
  label?: string;
  className?: string;
}

const CONFIG: Record<
  OverallRisk,
  { bg: string; text: string; border: string; Icon: typeof Shield; defaultLabel: string }
> = {
  low: {
    bg: 'bg-green-500/10',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-500/30',
    Icon: CheckCircle2,
    defaultLabel: '低风险',
  },
  medium: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-500/30',
    Icon: AlertTriangle,
    defaultLabel: '中风险',
  },
  high: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30',
    Icon: AlertTriangle,
    defaultLabel: '高风险',
  },
  critical: {
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/30',
    Icon: AlertOctagon,
    defaultLabel: '严重风险',
  },
  unknown: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    Icon: HelpCircle,
    defaultLabel: '风险未知',
  },
};

export function RiskBadge({ level, label, className }: Props) {
  const c = CONFIG[level];
  const Icon = c.Icon;
  return (
    <div
      className={[
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium',
        c.bg,
        c.text,
        c.border,
        className ?? '',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
      {label ?? c.defaultLabel}
    </div>
  );
}
