'use client';

/**
 * T-FE-ADMIN-V1.5-DASHBOARD · /admin BI 专业仪表盘
 *
 * 数据源:GET /admin/bi-metrics?window=24h|7d|30d|all
 * 鉴权:X-Admin-Key
 * 刷新:60s 自刷
 *
 * 5 section(从上到下):
 *   1. Volume 时间序列(hourly_24h 默认 / daily_30d 切换)· SVG dual-bar
 *   2. Conversion funnel(Connect → Quote → Swap)· 横向漏斗
 *   3. MEV rebate 累计 · 大数字 + 24h/7d 副 + 独立用户数
 *   4. tx 成功率 · SVG pie + % · 阈值染色
 *   5. trade size 分布 · 5 数字横排 + 中位数说明
 *
 * 降级原则(spec):任何 section 数据缺失 → "数据不足 · 等积累" · 不爆错
 *
 * 不引 recharts(已有 admin SVG 风格)/ SWR(useState+setInterval)/ i18n(/admin 全 zh)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, AlertCircle, GitBranch, Zap, CheckCircle2, Ruler } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  fetchAdminBIMetrics,
  type BIMetricsResp,
  type BIVolumeBucket,
  type FeeRevenueWindow,
} from '@/lib/api-client';
import { WindowSelector } from './window-selector';

const REFRESH_MS = 60_000;

export function BIMetricsCard({ adminKey }: { adminKey: string }) {
  const [window, setWindow] = useState<FeeRevenueWindow>('7d');
  const [data, setData] = useState<BIMetricsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchAdminBIMetrics(adminKey, window);
      setData(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [adminKey, window]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Card className="overflow-hidden" data-testid="admin-bi-metrics-card">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--brand-up)]" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            BI 专业指标
          </span>
        </div>
        <WindowSelector value={window} onChange={setWindow} testIdPrefix="bi-window" />
      </div>

      <div className="p-5 space-y-6" data-window={window}>
        {err ? (
          <div className="flex items-start gap-2 text-xs text-[var(--brand-down)]">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="break-all font-mono">{err}</span>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <VolumeTimeSeries hourly={data.hourly_volume_24h} daily={data.daily_volume_30d} />
            <SectionDivider />
            <ConversionFunnelSection data={data.conversion} />
            <SectionDivider />
            <MevRebateSection data={data.mev} />
            <SectionDivider />
            <SuccessRateSection data={data.success} />
            <SectionDivider />
            <TradeSizeDistSection data={data.trade_size} />

            {/* 顶 timestamp + loading */}
            <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-3 text-[11px] text-muted-foreground/70">
              <span>{new Date(data.computed_at).toLocaleString()}</span>
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function SectionDivider() {
  return <div className="h-px bg-border/30" aria-hidden="true" />;
}

function SectionTitle({ Icon, label }: { Icon: typeof BarChart3; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

function NoData({ hint }: { hint?: string }) {
  return (
    <div className="text-center text-xs text-muted-foreground/60 py-4" data-testid="bi-no-data">
      数据不足 · 等积累{hint && <span className="block text-[10px] text-muted-foreground/40 mt-1">{hint}</span>}
    </div>
  );
}

// ─── Section 1 · Volume 时间序列 ───────────────────────────────

function VolumeTimeSeries({
  hourly, daily,
}: {
  hourly: BIVolumeBucket[];
  daily: BIVolumeBucket[];
}) {
  const [mode, setMode] = useState<'hourly' | 'daily'>('hourly');
  const buckets = mode === 'hourly' ? hourly : daily;

  return (
    <section data-testid="bi-volume-section">
      <div className="flex items-center justify-between mb-2">
        <SectionTitle Icon={BarChart3} label="交易量时间序列" />
        <div className="flex items-center gap-1">
          <ModeChip active={mode === 'hourly'} onClick={() => setMode('hourly')} testId="bi-volume-hourly">
            24h(每小时)
          </ModeChip>
          <ModeChip active={mode === 'daily'} onClick={() => setMode('daily')} testId="bi-volume-daily">
            30d(每天)
          </ModeChip>
        </div>
      </div>
      {buckets.length === 0 ? (
        <NoData />
      ) : (
        <DualBarChart buckets={buckets} />
      )}
    </section>
  );
}

function ModeChip({
  active, onClick, children, testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
        active
          ? 'bg-[var(--brand-up)]/15 text-[var(--brand-up)]'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 双数据柱图 · 笔数(灰)+ USD(绿)双 Y 轴
 * 灰色细 bar 在后 + 绿色实 bar 在前(同一 X 但 Y 轴独立 normalize)
 */
function DualBarChart({ buckets }: { buckets: BIVolumeBucket[] }) {
  const W = 720;
  const H = 120;
  const padL = 32, padR = 32, padT = 8, padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxCount = useMemo(() => Math.max(1, ...buckets.map((b) => b.trade_count)), [buckets]);
  const maxVol = useMemo(() => Math.max(0.01, ...buckets.map((b) => b.volume_usd)), [buckets]);
  const barGap = 1;
  const slotW = innerW / buckets.length;
  const barW = Math.max(1, slotW - barGap);

  const totalCount = useMemo(() => buckets.reduce((s, b) => s + b.trade_count, 0), [buckets]);
  const totalVol = useMemo(() => buckets.reduce((s, b) => s + b.volume_usd, 0), [buckets]);

  return (
    <div className="space-y-1" data-testid="bi-volume-bar">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-mono text-muted-foreground">
          总笔数 <span className="text-foreground font-semibold">{totalCount.toLocaleString()}</span>
        </span>
        <span className="font-mono text-muted-foreground">
          总 USD <span className="text-[var(--brand-up)] font-semibold">${totalVol.toFixed(2)}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }} preserveAspectRatio="none">
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
        {buckets.map((b, i) => {
          const x = padL + i * slotW;
          const hCount = b.trade_count > 0 ? Math.max(1, (b.trade_count / maxCount) * innerH) : 0;
          const hVol = b.volume_usd > 0 ? Math.max(1, (b.volume_usd / maxVol) * innerH) : 0;
          return (
            <g key={b.bucket}>
              {/* 笔数(灰底)*/}
              <rect
                x={x}
                y={padT + innerH - hCount}
                width={barW}
                height={hCount}
                fill="rgba(255,255,255,0.18)"
              />
              {/* USD(绿前)· 偏窄一点 */}
              {hVol > 0 && (
                <rect
                  x={x + barW * 0.25}
                  y={padT + innerH - hVol}
                  width={barW * 0.5}
                  height={hVol}
                  fill="#19FB9B"
                  opacity={0.85}
                >
                  <title>{`${b.bucket} · ${b.trade_count} tx · $${b.volume_usd.toFixed(2)}`}</title>
                </rect>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <Legend color="rgba(255,255,255,0.3)" label="笔数" />
        <Legend color="#19FB9B" label="USD" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}

// ─── Section 2 · Conversion funnel ─────────────────────────────

function ConversionFunnelSection({ data }: { data: BIMetricsResp['conversion'] }) {
  const has = data.connect_count > 0 || (data.quote_request_count ?? 0) > 0 || data.swap_count > 0;

  return (
    <section data-testid="bi-funnel-section">
      <SectionTitle Icon={GitBranch} label="转化漏斗" />
      {!has ? (
        <NoData />
      ) : (
        <div className="space-y-2">
          <FunnelStage label="连接钱包" count={data.connect_count} max={Math.max(1, data.connect_count)} />
          {data.quote_request_count != null && (
            <FunnelStage
              label="报价请求"
              count={data.quote_request_count}
              max={Math.max(1, data.connect_count)}
            />
          )}
          <FunnelStage label="完成 Swap" count={data.swap_count} max={Math.max(1, data.connect_count)} />
          {data.connect_to_swap_rate != null && (
            <div className="text-[11px] text-muted-foreground pt-1">
              <span className="font-mono">连接 → Swap 转化率:</span>
              <span className="ml-1.5 font-mono font-semibold text-[var(--brand-up)]">
                {data.connect_to_swap_rate.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FunnelStage({
  label, count, max,
}: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono">{label}</span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--brand-up)]/60"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Section 3 · MEV rebate ────────────────────────────────────

function MevRebateSection({ data }: { data: BIMetricsResp['mev'] }) {
  const has = data.total_mev_rebate_sol > 0 || data.unique_recipients > 0;

  return (
    <section data-testid="bi-mev-section">
      <SectionTitle Icon={Zap} label="MEV 返还" />
      {!has ? (
        <NoData hint="待 Helius backrun events 累计" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <div
              className="font-mono text-2xl font-bold tabular-nums text-[var(--brand-up)]"
              data-testid="bi-mev-total-sol"
            >
              {data.total_mev_rebate_sol.toFixed(6)} SOL
            </div>
            <div className="text-xs text-muted-foreground">
              ≈ ${data.total_mev_rebate_usd.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground/70">
              · {data.unique_recipients.toLocaleString()} 个独立用户
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <SubStat label="24h" value={`${data.mev_24h_sol.toFixed(6)} SOL`} />
            <SubStat label="7d" value={`${data.mev_7d_sol.toFixed(6)} SOL`} />
          </div>
        </div>
      )}
    </section>
  );
}

function SubStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 px-3 py-2 rounded bg-muted/30">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground/90 tabular-nums">{value}</span>
    </div>
  );
}

// ─── Section 4 · 成功率 ────────────────────────────────────────

function SuccessRateSection({ data }: { data: BIMetricsResp['success'] }) {
  const total = data.swap_success_count + data.swap_fail_count;
  if (data.success_rate_pct == null || total === 0) {
    return (
      <section data-testid="bi-success-section">
        <SectionTitle Icon={CheckCircle2} label="Tx 成功率" />
        <NoData />
      </section>
    );
  }

  // 阈值染色:>95 绿 · 90-95 黄 · <90 红
  const tone =
    data.success_rate_pct >= 95
      ? 'text-[var(--brand-up)]'
      : data.success_rate_pct >= 90
        ? 'text-amber-500'
        : 'text-[var(--brand-down)]';

  // SVG 饼图 · 100×100 · 成功色用 tone-color · 失败 muted
  const cx = 50, cy = 50, r = 36;
  const C = 2 * Math.PI * r;
  const successPct = data.success_rate_pct;
  const successDash = (successPct / 100) * C;
  const successColor =
    successPct >= 95 ? '#19FB9B' : successPct >= 90 ? '#F59E0B' : '#FF6B6B';

  return (
    <section data-testid="bi-success-section">
      <SectionTitle Icon={CheckCircle2} label="Tx 成功率" />
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 100 100" className="w-20 h-20 flex-shrink-0" aria-label="成功率饼图">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={successColor}
            strokeWidth={10}
            strokeDasharray={`${successDash} ${C - successDash}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        </svg>
        <div className="space-y-1">
          <div
            className={`font-mono text-3xl font-bold tabular-nums ${tone}`}
            data-testid="bi-success-pct"
          >
            {data.success_rate_pct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            成功 {data.swap_success_count.toLocaleString()} ·
            失败 {data.swap_fail_count.toLocaleString()}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 5 · trade size 分布 ─────────────────────────────

function TradeSizeDistSection({ data }: { data: BIMetricsResp['trade_size'] }) {
  const allNull =
    data.min_trade_usd == null &&
    data.median_trade_usd == null &&
    data.mean_trade_usd == null &&
    data.p95_trade_usd == null &&
    data.max_trade_usd == null;

  return (
    <section data-testid="bi-tradesize-section">
      <SectionTitle Icon={Ruler} label="交易金额分布" />
      {allNull ? (
        <NoData hint="< 3 笔不算分布" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <DistStat label="最小" value={data.min_trade_usd} testId="bi-size-min" />
            <DistStat label="中位" value={data.median_trade_usd} highlight testId="bi-size-median" />
            <DistStat label="平均" value={data.mean_trade_usd} testId="bi-size-mean" />
            <DistStat label="P95" value={data.p95_trade_usd} testId="bi-size-p95" />
            <DistStat label="最大" value={data.max_trade_usd} testId="bi-size-max" />
          </div>
          {data.median_trade_usd != null && (
            <div className="text-[10px] text-muted-foreground/60 mt-2">
              中位数 ${data.median_trade_usd.toFixed(2)} 表示一半交易低于这个数。
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DistStat({
  label, value, highlight, testId,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
  testId: string;
}) {
  const tone = highlight ? 'text-[var(--brand-up)]' : 'text-foreground/90';
  return (
    <div className="px-2 py-2 rounded bg-muted/30 text-center" data-testid={testId}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-semibold tabular-nums mt-0.5 ${tone}`}>
        {value != null ? `$${value.toFixed(2)}` : '—'}
      </div>
    </div>
  );
}
