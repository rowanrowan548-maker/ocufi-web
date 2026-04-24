'use client';

import { Card } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { BarChart3 } from 'lucide-react';
import type { TokenDetail } from '@/lib/token-info';

interface Props {
  detail: TokenDetail | null;
}

export function InfoPanel({ detail }: Props) {
  const t = useTranslations();

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/40">
        <BarChart3 className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-semibold">{t('token.marketData')}</span>
      </div>
      <div className="space-y-2 text-sm">
        <Row
          label={t('token.marketCap')}
          value={detail ? `$${formatCompact(detail.marketCap)}` : '—'}
        />
        <Row
          label={t('token.liquidity')}
          value={detail ? `$${formatCompact(detail.liquidityUsd)}` : '—'}
          warn={detail != null && detail.liquidityUsd > 0 && detail.liquidityUsd < 50_000}
        />
        <Row
          label={t('token.volume24h')}
          value={detail?.volume24h ? `$${formatCompact(detail.volume24h)}` : '—'}
        />
        {detail?.buys24h != null && detail?.sells24h != null && (
          <Row
            label={t('token.buys24h')}
            value={`${detail.buys24h} / ${detail.sells24h}`}
            valueColor={
              detail.buys24h > detail.sells24h
                ? 'text-success'
                : detail.buys24h < detail.sells24h
                ? 'text-danger'
                : undefined
            }
          />
        )}
        {detail?.totalHolders != null && (
          <Row
            label={t('token.totalHolders')}
            value={detail.totalHolders.toLocaleString()}
          />
        )}
        <Row
          label={t('token.createdAt')}
          value={detail?.createdAt ? formatAge(detail.createdAt) : '—'}
        />
      </div>
    </Card>
  );
}

function Row({
  label, value, warn, valueColor,
}: {
  label: string;
  value: string;
  warn?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-mono ${
          warn ? 'text-warning' : valueColor ?? 'text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

function formatAge(createdAt: number): string {
  const hours = (Date.now() - createdAt) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.floor(hours * 60)}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  if (hours < 24 * 30) return `${Math.floor(hours / 24)}d`;
  if (hours < 24 * 365) return `${Math.floor(hours / 24 / 30)}mo`;
  return `${Math.floor(hours / 24 / 365)}y`;
}
