'use client';

/**
 * T-977 · OKX 风格移动端右栏数据列(50% 宽 · text-[11px] 极致紧凑)
 *
 * 整合 InfoPanel + SafetyPanel 关键字段,1 行 1-2 字段,扫不点。
 * 不包含完整 SafetyPanel/InfoPanel(那两个仍用于桌面 lg+)。
 */
import { useTranslations } from 'next-intl';
import type { TokenDetail } from '@/lib/token-info';
import { Check, X, HelpCircle, AlertTriangle } from 'lucide-react';

interface Props {
  detail: TokenDetail | null;
}

type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export function MobileDataColumn({ detail }: Props) {
  const t = useTranslations();

  const mintAuthStatus: CheckStatus = !detail || !detail.hasRugCheckData
    ? 'unknown'
    : detail.mintAuthority === null ? 'pass' : 'fail';
  const freezeAuthStatus: CheckStatus = !detail || !detail.hasRugCheckData
    ? 'unknown'
    : detail.freezeAuthority === null ? 'pass' : 'fail';
  const top10Status: CheckStatus = !detail || detail.top10Pct === null
    ? 'unknown'
    : detail.top10Pct > 80 ? 'fail' : detail.top10Pct > 50 ? 'warn' : 'pass';
  const lpStatus: CheckStatus = !detail || detail.lpLockedPct === null
    ? 'unknown'
    : detail.lpLockedPct >= 70 ? 'pass' : detail.lpLockedPct >= 20 ? 'warn' : 'fail';

  return (
    <div className="rounded-md border border-border/40 bg-card/40 p-2 space-y-1.5 text-[11px] leading-tight tabular-nums">
      <DataRow
        label={t('token.marketCap')}
        value={detail ? `$${formatCompact(detail.marketCap)}` : '—'}
      />
      <DataRow
        label={t('token.liquidity')}
        value={detail ? `$${formatCompact(detail.liquidityUsd)}` : '—'}
        warn={detail != null && detail.liquidityUsd > 0 && detail.liquidityUsd < 50_000}
      />
      {detail?.volume24h != null && (
        <DataRow
          label={t('token.volume24h')}
          value={`$${formatCompact(detail.volume24h)}`}
        />
      )}
      {detail?.totalHolders != null && (
        <DataRow
          label={t('token.totalHolders')}
          value={detail.totalHolders.toLocaleString()}
        />
      )}
      <div className="border-t border-border/40 pt-1.5 mt-1.5 space-y-1.5">
        <CheckLine
          label={t('token.top10Holders')}
          status={top10Status}
          text={detail?.top10Pct != null ? `${detail.top10Pct.toFixed(1)}%` : '—'}
        />
        <CheckLine
          label={t('token.lpLocked')}
          status={lpStatus}
          text={detail?.lpLockedPct != null ? `${detail.lpLockedPct.toFixed(1)}%` : '—'}
        />
        <CheckLine
          label={t('token.mintAuthority')}
          status={mintAuthStatus}
          text={mintAuthStatus === 'pass' ? t('token.status.renounced') : mintAuthStatus === 'fail' ? t('token.status.active') : '—'}
        />
        <CheckLine
          label={t('token.freezeAuthority')}
          status={freezeAuthStatus}
          text={freezeAuthStatus === 'pass' ? t('token.status.renounced') : freezeAuthStatus === 'fail' ? t('token.status.active') : '—'}
        />
      </div>
    </div>
  );
}

function DataRow({
  label, value, warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={`font-mono ${warn ? 'text-warning' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

function CheckLine({
  label, status, text,
}: {
  label: string;
  status: CheckStatus;
  text: string;
}) {
  const config: Record<CheckStatus, { Icon: typeof Check; cls: string }> = {
    pass: { Icon: Check, cls: 'text-success' },
    warn: { Icon: AlertTriangle, cls: 'text-warning' },
    fail: { Icon: X, cls: 'text-danger' },
    unknown: { Icon: HelpCircle, cls: 'text-muted-foreground' },
  };
  const { Icon, cls } = config[status];
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={`inline-flex items-center gap-0.5 font-mono ${cls}`}>
        <Icon className="h-2.5 w-2.5 flex-shrink-0" />
        <span className="truncate">{text}</span>
      </span>
    </div>
  );
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}
