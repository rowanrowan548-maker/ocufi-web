'use client';

/**
 * T-901 · 5 张 stat 卡片的迷你可视化元素
 *
 * 设计:
 *   - 不引入新图表库,纯 SVG / div bar
 *   - 颜色:正绿 oklch(0.78 0.18 145),负粉 oklch(0.65 0.22 25),中性 muted
 *   - 容器固定高度 60-72px,确保 5 卡卡 min-h-[140px] 一致
 */
import type { ClosedPosition } from '@/lib/cost-basis';
import type { TxRecord } from '@/lib/tx-history';

const POS = 'oklch(0.78 0.18 145)';
const NEG = 'oklch(0.65 0.22 25)';

// ── 1. 已实现卡 · 7 日每日盈亏柱(横向 7 根) ──────────────────────

export function DailyPnlBars({ closed }: { closed: ClosedPosition[] }) {
  // 桶分到过去 7 天(包括今天 = day 0)
  const now = Date.now();
  const buckets: number[] = Array(7).fill(0);
  for (const p of closed) {
    const ageMs = now - p.closedAt * 1000;
    const dayIdx = Math.floor(ageMs / 86400000);
    if (dayIdx >= 0 && dayIdx < 7) {
      // 索引反转:最右是今天(idx 0),最左是 6 天前
      buckets[6 - dayIdx] += p.realizedPnlSol;
    }
  }
  const max = Math.max(...buckets.map(Math.abs));
  if (max <= 0) {
    return <BarsEmpty />;
  }
  return (
    <div className="flex items-end gap-1 h-[44px] w-full">
      {buckets.map((v, i) => {
        const h = Math.max(2, (Math.abs(v) / max) * 40);
        const color = v > 0 ? POS : v < 0 ? NEG : 'oklch(0.5 0.02 230)';
        return (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${h}px`,
              background: v === 0 ? 'oklch(0.4 0.01 230 / 0.3)' : color,
              opacity: v === 0 ? 0.4 : 0.85,
            }}
          />
        );
      })}
    </div>
  );
}

// ── 2. TopGainer 卡 · TOP3 token 垂直柱 ────────────────────────

export interface TopGainer {
  symbol: string;
  pnlPct: number;
  pnlUsd: number;
}

export function TopGainerBars({ items }: { items: TopGainer[] }) {
  if (items.length === 0) return <BarsEmpty />;
  const max = Math.max(...items.map((i) => Math.abs(i.pnlPct)), 1);
  // 补齐到 3 根
  const pad: TopGainer[] = items.slice(0, 3);
  while (pad.length < 3) pad.push({ symbol: '—', pnlPct: 0, pnlUsd: 0 });

  return (
    <div className="flex items-end gap-2 h-[44px] w-full">
      {pad.map((it, i) => {
        const h = Math.max(2, (Math.abs(it.pnlPct) / max) * 40);
        const color = it.pnlPct > 0 ? POS : it.pnlPct < 0 ? NEG : 'oklch(0.5 0.02 230)';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-sm"
              style={{
                height: `${h}px`,
                background: it.pnlPct === 0 ? 'oklch(0.4 0.01 230 / 0.3)' : color,
                opacity: it.pnlPct === 0 ? 0.4 : 0.85,
              }}
            />
            <span className="text-[9px] font-mono text-muted-foreground/70 truncate max-w-full">
              {it.symbol}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 3. 胜率卡 · 4 档 PnL% 分布(>500% / 0~500% / -50~0% / <-50%) ──

export function WinDistRows({ closed }: { closed: ClosedPosition[] }) {
  const buckets = [
    { label: '>500%', test: (p: number) => p > 500, color: POS, count: 0 },
    { label: '0~500%', test: (p: number) => p > 0 && p <= 500, color: POS, count: 0 },
    { label: '-50~0%', test: (p: number) => p <= 0 && p > -50, color: NEG, count: 0 },
    { label: '<-50%', test: (p: number) => p <= -50, color: NEG, count: 0 },
  ];
  for (const p of closed) {
    for (const b of buckets) {
      if (b.test(p.realizedPnlPct)) {
        b.count++;
        break;
      }
    }
  }
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="space-y-1 w-full">
      {buckets.map((b) => (
        <div key={b.label} className="flex items-center gap-1.5 text-[9px] font-mono">
          <span className="text-muted-foreground/70 w-[44px] tabular-nums shrink-0">
            {b.label}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(b.count / max) * 100}%`,
                background: b.color,
                opacity: b.count > 0 ? 0.7 : 0.2,
              }}
            />
          </div>
          <span className="text-muted-foreground tabular-nums w-[16px] text-right shrink-0">
            {b.count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 4. 买卖卡 · OKX 风格 buy/sell 横条已在父组件,这里不重复 ──

// ── 5. 已节省手续费卡 · mini 累计折线(从 tx records 累加) ──────

export function SavedFeesLine({
  records,
  solUsd,
}: {
  records: TxRecord[];
  solUsd: number;
}) {
  // 按时间正序 + 仅成功 buy/sell · 每笔节省 = solAmount × 0.003 × solUsd
  const sorted = [...records]
    .filter((r) => !r.err && (r.type === 'buy' || r.type === 'sell') && r.solAmount > 0)
    .sort((a, b) => (a.blockTime ?? 0) - (b.blockTime ?? 0));
  if (sorted.length < 2 || solUsd <= 0) return <BarsEmpty />;

  let cum = 0;
  const points = sorted.map((r) => {
    cum += r.solAmount * 0.003 * solUsd;
    return { ts: r.blockTime ?? 0, v: cum };
  });

  const W = 200;
  const H = 44;
  const pad = 2;
  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.v);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax || 1;

  const toX = (ts: number) => pad + ((ts - xMin) / xRange) * (W - 2 * pad);
  const toY = (v: number) => H - pad - (v / yRange) * (H - 2 * pad);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.ts)} ${toY(p.v)}`)
    .join(' ');
  const areaPath = `${linePath} L ${toX(xMax)} ${H - pad} L ${toX(xMin)} ${H - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[44px]"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="saved-fees-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={POS} stopOpacity="0.3" />
          <stop offset="100%" stopColor={POS} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#saved-fees-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke={POS}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── helpers ───────────────────────────────────────────────

function BarsEmpty() {
  return (
    <div className="flex items-center justify-center h-[44px] w-full text-[10px] text-muted-foreground/40 font-mono">
      —
    </div>
  );
}
