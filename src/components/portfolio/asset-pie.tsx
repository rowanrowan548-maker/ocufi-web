'use client';

/**
 * 资产分布甜甜圈 · 纯 SVG 绘制
 *
 * 取持仓的前 5 大,其余合并为「其他」
 * 中心显示总值(USD)
 */
import { useMemo } from 'react';

interface Slice {
  label: string;
  symbol: string;
  valueUsd: number;
  color: string;
}

interface Props {
  /** 各资产 USD 值,按数组顺序 */
  items: Array<{ symbol: string; valueUsd: number }>;
  totalUsd: number;
  size?: number;
}

const PALETTE = [
  '#19FB9B', // primary green
  '#7B5BFF', // purple
  '#FF7B5B', // orange
  '#FFC229', // amber
  '#5BC8FF', // cyan
  '#A1A1AA', // muted (others)
];

export function AssetPie({ items, totalUsd, size = 180 }: Props) {
  const slices: Slice[] = useMemo(() => {
    const filtered = items.filter((i) => i.valueUsd > 0);
    if (filtered.length === 0) return [];
    const sorted = [...filtered].sort((a, b) => b.valueUsd - a.valueUsd);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const restValue = rest.reduce((s, r) => s + r.valueUsd, 0);
    const result: Slice[] = top.map((t, i) => ({
      label: t.symbol,
      symbol: t.symbol,
      valueUsd: t.valueUsd,
      color: PALETTE[i] ?? PALETTE[5],
    }));
    if (restValue > 0) {
      result.push({
        label: '其他',
        symbol: 'others',
        valueUsd: restValue,
        color: PALETTE[5],
      });
    }
    return result;
  }, [items]);

  if (slices.length === 0 || totalUsd <= 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        —
      </div>
    );
  }

  // 单 slice 100% 时直接画整圆,绕过弧线计算
  const isSingle = slices.length === 1;
  const radius = size / 2;
  const inner = radius * 0.62;
  const cx = radius;
  const cy = radius;

  // 各 slice 起止角度
  let cum = 0;
  const arcs = slices.map((s) => {
    const pct = s.valueUsd / totalUsd;
    const start = cum;
    const end = cum + pct;
    cum = end;
    return { ...s, start, end, pct };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      {isSingle ? (
        <>
          <circle cx={cx} cy={cy} r={radius} fill={arcs[0].color} />
          <circle cx={cx} cy={cy} r={inner} fill="oklch(0.18 0.01 220)" />
        </>
      ) : (
        arcs.map((a, i) => (
          <path
            key={i}
            d={donutSlicePath(cx, cy, radius, inner, a.start, a.end)}
            fill={a.color}
          />
        ))
      )}
      {/* 中心总值 */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)' }}
      >
        TOTAL
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}
      >
        ${formatCompact(totalUsd)}
      </text>
    </svg>
  );
}

/** SVG donut slice (起始 / 结束以 0..1 表示一周) */
function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  const a0 = start * Math.PI * 2 - Math.PI / 2;
  const a1 = end * Math.PI * 2 - Math.PI / 2;
  const large = end - start > 0.5 ? 1 : 0;

  const x0o = cx + rOuter * Math.cos(a0);
  const y0o = cy + rOuter * Math.sin(a0);
  const x1o = cx + rOuter * Math.cos(a1);
  const y1o = cy + rOuter * Math.sin(a1);
  const x0i = cx + rInner * Math.cos(a0);
  const y0i = cy + rInner * Math.sin(a0);
  const x1i = cx + rInner * Math.cos(a1);
  const y1i = cy + rInner * Math.sin(a1);

  return [
    `M ${x0o} ${y0o}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x0i} ${y0i}`,
    'Z',
  ].join(' ');
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

/** Legend 用:slice 颜色 + 标签 + 占比 */
export function AssetPieLegend({
  items, totalUsd,
}: {
  items: Array<{ symbol: string; valueUsd: number }>;
  totalUsd: number;
}) {
  const sorted = useMemo(
    () => [...items].filter((i) => i.valueUsd > 0).sort((a, b) => b.valueUsd - a.valueUsd),
    [items]
  );
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const restValue = rest.reduce((s, r) => s + r.valueUsd, 0);

  return (
    <div className="space-y-1.5 text-xs">
      {top.map((t, i) => (
        <Item
          key={t.symbol + i}
          color={PALETTE[i] ?? PALETTE[5]}
          symbol={t.symbol}
          pct={totalUsd > 0 ? (t.valueUsd / totalUsd) * 100 : 0}
          valueUsd={t.valueUsd}
        />
      ))}
      {restValue > 0 && (
        <Item
          color={PALETTE[5]}
          symbol={`其他 (${rest.length})`}
          pct={totalUsd > 0 ? (restValue / totalUsd) * 100 : 0}
          valueUsd={restValue}
        />
      )}
    </div>
  );
}

function Item({
  color, symbol, pct, valueUsd,
}: {
  color: string;
  symbol: string;
  pct: number;
  valueUsd: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
        style={{ background: color }}
      />
      <span className="font-medium truncate flex-1 min-w-0">{symbol}</span>
      <span className="font-mono text-muted-foreground tabular-nums">
        {pct.toFixed(1)}%
      </span>
      <span className="font-mono text-foreground/80 tabular-nums w-16 text-right">
        ${formatCompact(valueUsd)}
      </span>
    </div>
  );
}
