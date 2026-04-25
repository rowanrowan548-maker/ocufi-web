'use client';

/**
 * 后台图表组件 · 纯 SVG,无外部依赖
 *  - DailyBarChart:30 天每天交易数 / 钱包数
 *  - HourlyHeatmap:24 小时活跃热度
 */
import type { AdminTimeBucket } from '@/lib/api-client';

interface DailyBarProps {
  data: AdminTimeBucket[];
  label: string;
  accent?: string;     // 柱子色
  height?: number;
}

export function DailyBarChart({
  data, label, accent = '#19FB9B', height = 180,
}: DailyBarProps) {
  const W = 720;
  const padL = 40, padR = 12, padT = 18, padB = 28;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);

  const barGap = 2;
  const barW = Math.max(2, (innerW / data.length) - barGap);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
        <span className="font-mono text-muted-foreground">
          总计 <span className="text-foreground font-semibold">{total.toLocaleString()}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ maxHeight: height }} preserveAspectRatio="none">
        {/* Y axis lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={padL}
            x2={W - padR}
            y1={padT + innerH * (1 - p)}
            y2={padT + innerH * (1 - p)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}
        {/* Y axis labels (max only) */}
        <text
          x={padL - 6}
          y={padT + 4}
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
        >
          {max}
        </text>
        <text
          x={padL - 6}
          y={padT + innerH}
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
        >
          0
        </text>

        {/* bars */}
        {data.map((d, i) => {
          const h = (d.count / max) * innerH;
          const x = padL + i * (barW + barGap);
          const y = padT + innerH - h;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(1, h)}
                rx={1.5}
                fill={accent}
                opacity={d.count > 0 ? 0.9 : 0.15}
              >
                <title>{d.date}: {d.count}</title>
              </rect>
            </g>
          );
        })}

        {/* X axis labels: first / mid / last */}
        {data.length > 0 && (
          <>
            <text x={padL} y={height - 8}
              className="fill-muted-foreground"
              style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            >
              {data[0].date.slice(5)}
            </text>
            <text x={(W) / 2} y={height - 8} textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            >
              {data[Math.floor(data.length / 2)].date.slice(5)}
            </text>
            <text x={W - padR} y={height - 8} textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            >
              {data[data.length - 1].date.slice(5)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * 24 小时活跃热度图
 * 横向 24 个小格,颜色深浅表示当小时事件数
 */
export function HourlyHeatmap({ data }: { data: AdminTimeBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  // 当前小时索引(用于高亮)
  const currentHour = new Date().getHours();

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
          过去 24h 活跃热度
        </span>
        <span className="font-mono text-muted-foreground">
          总计 <span className="text-foreground font-semibold">{total}</span> 笔
        </span>
      </div>
      <div className="grid grid-cols-12 sm:grid-cols-24 gap-1">
        {data.map((d) => {
          const intensity = d.count / max;
          const isCurrent = parseInt(d.date) === currentHour;
          return (
            <div
              key={d.date}
              className="aspect-square rounded-sm relative group"
              style={{
                backgroundColor: d.count > 0
                  ? `rgba(25, 251, 155, ${0.15 + intensity * 0.85})`
                  : 'rgba(255,255,255,0.04)',
                outline: isCurrent ? '1.5px solid #19FB9B' : 'none',
                outlineOffset: '1px',
              }}
              title={`${d.date}:00 — ${d.count} 笔`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-muted-foreground/60 sm:opacity-0 group-hover:opacity-100">
                {d.date}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 font-mono">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}
