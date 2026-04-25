'use client';

/**
 * 总资产历史曲线 · SVG line + area
 *
 * 数据源:localStorage(每次打开 portfolio 写一条快照)
 * 范围:7d / 30d 切换
 *
 * 数据点 < 2 时显示「数据采集中」空态,提示用户多用几天就有图
 */
import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Snapshot } from '@/lib/portfolio-history';
import { snapshotsInRange } from '@/lib/portfolio-history';
import { useTranslations } from 'next-intl';

interface Props {
  snapshots: Snapshot[];
  /** 当前总值,数据点不够时画一条平直线兜底 */
  currentTotalUsd?: number;
}

export function ValueChart({ snapshots, currentTotalUsd }: Props) {
  const t = useTranslations('portfolio.chart');
  const [range, setRange] = useState<'7d' | '30d'>('7d');

  const points = useMemo(
    () => snapshotsInRange(snapshots, range === '7d' ? 7 : 30),
    [snapshots, range]
  );

  // 数据不足时构造平直线:当前值 + 一个早 N 天的同值点
  const renderPoints = useMemo<Snapshot[]>(() => {
    if (points.length >= 2) return points;
    const baseValue =
      points.length === 1
        ? points[0].totalUsd
        : currentTotalUsd ?? 0;
    if (baseValue <= 0) return [];
    const now = Date.now();
    const rangeMs = (range === '7d' ? 7 : 30) * 24 * 3600 * 1000;
    return [
      { ts: now - rangeMs, totalUsd: baseValue },
      { ts: now, totalUsd: baseValue },
    ];
  }, [points, currentTotalUsd, range]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('title')}
          </div>
          {points.length >= 2 && <ChangeBadge points={points} />}
          {points.length < 2 && renderPoints.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60 font-mono tabular-nums">
              {t('collectingShort')}
            </span>
          )}
        </div>
        <Tabs value={range} onValueChange={(v) => v && setRange(v as '7d' | '30d')}>
          <TabsList className="h-7">
            <TabsTrigger value="7d" className="text-xs px-3">7d</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-3">30d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {renderPoints.length === 0 ? (
        <div className="h-[160px] rounded-md border border-dashed border-border/50 flex items-center justify-center text-xs text-muted-foreground/60">
          —
        </div>
      ) : (
        <Sparkline points={renderPoints} flat={points.length < 2} />
      )}
    </div>
  );
}

function ChangeBadge({ points }: { points: Snapshot[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  if (first.totalUsd === 0) return null;
  const delta = last.totalUsd - first.totalUsd;
  const pct = (delta / first.totalUsd) * 100;
  const color =
    pct > 0 ? 'text-success' : pct < 0 ? 'text-danger' : 'text-muted-foreground';
  return (
    <span className={`text-xs font-mono font-medium tabular-nums ${color}`}>
      {pct > 0 ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  );
}

function Sparkline({ points, flat }: { points: Snapshot[]; flat?: boolean }) {
  const W = 720;
  const H = 160;
  const pad = 8;

  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.totalUsd);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || Math.max(yMax * 0.01, 1);

  const toX = (ts: number) => pad + ((ts - xMin) / xRange) * (W - 2 * pad);
  const toY = (v: number) => H - pad - ((v - yMin) / yRange) * (H - 2 * pad);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.ts)} ${toY(p.totalUsd)}`)
    .join(' ');
  const areaPath =
    `${linePath} L ${toX(xMax)} ${H - pad} L ${toX(xMin)} ${H - pad} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const up = last.totalUsd >= first.totalUsd;
  // flat = 数据点不够,用中性灰避免误导用户「在涨」
  const stroke = flat
    ? 'oklch(0.6 0.02 220)'
    : up
    ? 'oklch(0.85 0.25 155)'
    : 'oklch(0.7 0.22 30)';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[160px]"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="value-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#value-chart-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 末点高亮 */}
      <circle cx={toX(last.ts)} cy={toY(last.totalUsd)} r={3} fill={stroke} />
    </svg>
  );
}
