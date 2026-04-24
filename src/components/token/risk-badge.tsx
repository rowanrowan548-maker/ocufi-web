import { Shield, ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle, CheckCircle2 } from 'lucide-react';
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
  verified: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    Icon: ShieldCheck,
    defaultLabel: '已验证',
  },
  low: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/30',
    Icon: CheckCircle2,
    defaultLabel: '低风险',
  },
  medium: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/30',
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
    bg: 'bg-danger/10',
    text: 'text-danger',
    border: 'border-danger/30',
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
