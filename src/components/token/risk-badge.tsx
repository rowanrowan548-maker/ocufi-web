/**
 * 风险徽章 · Ocufi 视觉版
 *
 * 风格:小 pill,1px 边框 + 半透明色块,无双层 emoji。
 * verified 单独走主色青绿,其他走对应语义色。
 */
import {
  ShieldCheck, CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle,
} from 'lucide-react';
import type { OverallRisk } from '@/lib/token-info';

interface Props {
  level: OverallRisk;
  label?: string;
  className?: string;
}

const CONFIG: Record<
  OverallRisk,
  { color: string; Icon: typeof ShieldCheck; defaultLabel: string }
> = {
  verified: {
    // verified 走 primary 主色青绿(品牌色)
    color: 'text-primary border-primary/30 bg-primary/10',
    Icon: ShieldCheck,
    defaultLabel: '已验证',
  },
  low: {
    color: 'text-success border-success/30 bg-success/10',
    Icon: CheckCircle2,
    defaultLabel: '低风险',
  },
  medium: {
    color: 'text-warning border-warning/30 bg-warning/10',
    Icon: AlertTriangle,
    defaultLabel: '中风险',
  },
  high: {
    color: 'text-warning border-warning/40 bg-warning/15',
    Icon: AlertTriangle,
    defaultLabel: '高风险',
  },
  critical: {
    color: 'text-danger border-danger/30 bg-danger/10',
    Icon: AlertOctagon,
    defaultLabel: '严重风险',
  },
  unknown: {
    color: 'text-muted-foreground border-border bg-muted/40',
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
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium tracking-tight whitespace-nowrap',
        c.color,
        className ?? '',
      ].join(' ')}
    >
      <Icon className="h-3 w-3" />
      {label ?? c.defaultLabel}
    </div>
  );
}
