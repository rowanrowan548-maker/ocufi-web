'use client';

/**
 * 安全信号 · 4 项快速决策面板
 *
 * 跟 SafetyPanel 区分:本组件做精华 4 项老司机一眼判定,
 * SafetyPanel 继续做 RugCheck 完整明细深度研究。
 *
 * 4 项:
 *   - LP 锁定 %      lpLockedPct
 *   - Top1 持仓 %    topHolders[0].pct
 *   - Mint 权        mintAuthority(null/'' = 已放弃)
 *   - Freeze 权      freezeAuthority(null/'' = 已放弃)
 *
 * 颜色按值判定 safe / warn / danger,detail=null 时全 `—` 占位不崩。
 */
import { Lock, Users, Coins, Snowflake, Circle, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { overallRisk, type TokenDetail, type OverallRisk } from '@/lib/token-info';

type Tone = 'safe' | 'warn' | 'danger' | 'neutral' | 'muted';

const TONE_CLASS: Record<Tone, string> = {
  safe: 'text-success',
  warn: 'text-warning',
  danger: 'text-destructive',
  neutral: 'text-foreground',
  muted: 'text-muted-foreground',
};

interface Props {
  detail: TokenDetail | null;
}

export function TrustSignals({ detail }: Props) {
  const t = useTranslations('trade.trust');

  const lp = lpSignal(detail?.lpLockedPct ?? null);
  const top1 = top1Signal(detail?.topHolders?.[0]?.pct ?? null);
  const mintAuth = authoritySignal(detail?.mintAuthority ?? null, t);
  const freezeAuth = authoritySignal(detail?.freezeAuthority ?? null, t);

  // T-926 #42:总评红绿灯 — 顶部一个 dot + 文字总评,默认展开 4 项
  const overall = detail ? overallRisk(detail) : 'unknown';
  const lightInfo = trafficLightInfo(overall);

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-foreground/80">
          {t('title')}
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-mono ${lightInfo.colorClass}`}>
          <lightInfo.Icon className="h-3.5 w-3.5 fill-current" />
          <span>{t(`overall.${overall}`)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Cell
          icon={<Lock className="h-3.5 w-3.5" />}
          label={t('labels.lpLocked')}
          value={lp.text}
          tone={lp.tone}
        />
        <Cell
          icon={<Users className="h-3.5 w-3.5" />}
          label={t('labels.top1Holder')}
          value={top1.text}
          tone={top1.tone}
        />
        <Cell
          icon={<Coins className="h-3.5 w-3.5" />}
          label={t('labels.mintAuthority')}
          value={mintAuth.text}
          tone={mintAuth.tone}
        />
        <Cell
          icon={<Snowflake className="h-3.5 w-3.5" />}
          label={t('labels.freezeAuthority')}
          value={freezeAuth.text}
          tone={freezeAuth.tone}
        />
      </div>
    </Card>
  );
}

function Cell({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className={`text-sm font-mono font-medium truncate ${TONE_CLASS[tone]}`}>
        {value}
      </span>
    </div>
  );
}

function lpSignal(pct: number | null): { text: string; tone: Tone } {
  if (pct == null || !Number.isFinite(pct)) return { text: '—', tone: 'muted' };
  const text = `${pct.toFixed(1)}%`;
  if (pct < 5) return { text, tone: 'danger' };
  if (pct < 20) return { text, tone: 'warn' };
  if (pct >= 80) return { text, tone: 'safe' };
  return { text, tone: 'neutral' };
}

function top1Signal(pct: number | null): { text: string; tone: Tone } {
  if (pct == null || !Number.isFinite(pct)) return { text: '—', tone: 'muted' };
  const text = `${pct.toFixed(1)}%`;
  if (pct >= 80) return { text, tone: 'danger' };
  if (pct >= 50) return { text, tone: 'warn' };
  if (pct < 20) return { text, tone: 'safe' };
  return { text, tone: 'neutral' };
}

function authoritySignal(
  auth: string | null,
  t: ReturnType<typeof useTranslations>,
): { text: string; tone: Tone } {
  // null / 空字符串 → 已放弃(safe)
  if (!auth) return { text: t('values.renounced'), tone: 'safe' };
  return { text: t('values.active'), tone: 'warn' };
}

// T-926 #42 + T-ICON-UNIFY:overallRisk → 红绿灯(lucide Circle filled)+ 颜色
function trafficLightInfo(risk: OverallRisk): { Icon: LucideIcon; colorClass: string } {
  switch (risk) {
    case 'verified':
    case 'low':
      return { Icon: Circle, colorClass: 'text-success' };
    case 'medium':
      return { Icon: Circle, colorClass: 'text-warning' };
    case 'high':
    case 'critical':
      return { Icon: Circle, colorClass: 'text-destructive' };
    case 'unknown':
    default:
      return { Icon: Circle, colorClass: 'text-muted-foreground' };
  }
}
