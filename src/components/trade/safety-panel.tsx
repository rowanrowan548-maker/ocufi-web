'use client';

import { Card } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { Shield, Check, X, HelpCircle, AlertTriangle } from 'lucide-react';
import type { TokenDetail } from '@/lib/token-info';

interface Props {
  detail: TokenDetail | null;
}

type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export function SafetyPanel({ detail }: Props) {
  const t = useTranslations();

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/40">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-semibold">{t('token.safetyChecks')}</span>
      </div>
      <div className="space-y-2 text-sm">
        <CheckRow
          label={t('token.mintAuthority')}
          status={
            !detail || !detail.hasRugCheckData
              ? 'unknown'
              : detail.mintAuthority === null
              ? 'pass'
              : 'fail'
          }
          passText={t('token.status.renounced')}
          failText={t('token.status.active')}
        />
        <CheckRow
          label={t('token.freezeAuthority')}
          status={
            !detail || !detail.hasRugCheckData
              ? 'unknown'
              : detail.freezeAuthority === null
              ? 'pass'
              : 'fail'
          }
          passText={t('token.status.renounced')}
          failText={t('token.status.active')}
        />
        <CheckRow
          label={t('token.top10Holders')}
          status={
            !detail || detail.top10Pct === null
              ? 'unknown'
              : detail.top10Pct > 80
              ? 'fail'
              : detail.top10Pct > 50
              ? 'warn'
              : 'pass'
          }
          text={detail?.top10Pct != null ? `${detail.top10Pct.toFixed(1)}%` : '—'}
        />
        <CheckRow
          label={t('token.lpLocked')}
          status={
            !detail || detail.lpLockedPct === null
              ? 'unknown'
              : detail.lpLockedPct >= 70
              ? 'pass'
              : detail.lpLockedPct >= 20
              ? 'warn'
              : 'fail'
          }
          text={detail?.lpLockedPct != null ? `${detail.lpLockedPct.toFixed(1)}%` : '—'}
        />
      </div>
    </Card>
  );
}

interface CheckRowProps {
  label: string;
  status: CheckStatus;
  /** 通用 text(覆盖 pass/fail Text) */
  text?: string;
  passText?: string;
  failText?: string;
}

function CheckRow({ label, status, text, passText, failText }: CheckRowProps) {
  const config: Record<CheckStatus, { Icon: typeof Check; cls: string; defaultText: string }> = {
    pass: { Icon: Check, cls: 'text-success', defaultText: passText ?? '✓' },
    warn: { Icon: AlertTriangle, cls: 'text-warning', defaultText: '!' },
    fail: { Icon: X, cls: 'text-danger', defaultText: failText ?? '✗' },
    unknown: { Icon: HelpCircle, cls: 'text-muted-foreground', defaultText: '—' },
  };
  const { Icon, cls, defaultText } = config[status];
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1 font-mono ${cls}`}>
        <Icon className="h-3 w-3" />
        {text ?? defaultText}
      </span>
    </div>
  );
}
