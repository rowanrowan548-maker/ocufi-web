'use client';

/**
 * T-FE-ADMIN-FEE-DASHBOARD · /admin 费用收入仪表盘
 *
 * 数据源:GET /admin/fee-revenue?window=24h|7d|30d|all
 * 鉴权:X-Admin-Key header(走 admin-screen 拿到的 ?key= URL param)
 * 刷新:60s 自刷(切 window 立刻刷)
 *
 * UI(从上到下):
 *   1. 4 个 window chip:24h / 7d(默认) / 30d / 全部
 *   2. 大数字:total_sol(品牌绿)+ total_usd(小)+ tx_count(灰)
 *   3. 7-day 柱状(仅 window=7d|30d 显示 · 高 80px)
 *   4. Top 5 贡献者表(末 4 位 + Solscan)
 *   5. 底部"在 Solscan 上看完整 →"
 *
 * 不做(spec 明确):
 *   - 不做提现按钮(费用地址私钥不在链路里 · 手动操作)
 *   - 不算预测/趋势(数据量太小)
 *
 * i18n:跟现有 /admin 一致 · 全 zh 硬编码(spec 提了 i18n · 但 admin-screen 全 hardcoded
 * 中文 · 单加一卡片做 i18n 反而割裂 · 走一致性 · 整 /admin 国际化是单独 cleanup)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, AlertCircle, Coins } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  fetchAdminFeeRevenue,
  type FeeRevenueResp,
  type FeeRevenueWindow,
} from '@/lib/api-client';

const REFRESH_MS = 60_000;
const WINDOWS: { key: FeeRevenueWindow; label: string }[] = [
  { key: '24h', label: '24 小时' },
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: 'all', label: '全部' },
];

export function FeeRevenueCard({ adminKey }: { adminKey: string }) {
  const [window, setWindow] = useState<FeeRevenueWindow>('7d');
  const [data, setData] = useState<FeeRevenueResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchAdminFeeRevenue(adminKey, window);
      setData(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [adminKey, window]);

  useEffect(() => {
    // 跟 admin-screen.tsx 一致的"effect 内首次 fetch + setInterval 自刷"模式 ·
    // React 19 react-hooks/set-state-in-effect 规则会标 · 但 admin 全文件都这样
    // (60s 定刷不需要 useSyncExternalStore 重武器)· 走一致性 disable
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const showBar = window === '7d' || window === '30d';

  return (
    <Card className="overflow-hidden" data-testid="admin-fee-revenue-card">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-[var(--brand-up)]" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            费用收入(0.1% 买入费)
          </span>
        </div>
        {/* 4 chip 窗口选择 */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label="时间窗口">
          {WINDOWS.map((w) => {
            const active = w.key === window;
            return (
              <button
                key={w.key}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`fee-window-${w.key}`}
                onClick={() => setWindow(w.key)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--brand-up)]/15 text-[var(--brand-up)]'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 space-y-5" data-window={window}>
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
            {/* 大数字行 */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <div
                className="font-mono text-3xl sm:text-4xl font-bold tabular-nums text-[var(--brand-up)]"
                data-testid="fee-total-sol"
              >
                {data.total_sol.toFixed(6)} SOL
              </div>
              <div className="text-xs text-muted-foreground" data-testid="fee-total-usd">
                ≈ ${data.total_usd.toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground/70" data-testid="fee-tx-count">
                · {data.tx_count.toLocaleString()} 笔
              </div>
              {loading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
              )}
            </div>

            {/* 柱状(仅 7d / 30d) */}
            {showBar && data.daily.length > 0 && (
              <FeeBarChart daily={data.daily} />
            )}

            {/* Top 5 senders */}
            {data.top_senders.length > 0 && (
              <div data-testid="fee-top-senders">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Top 贡献者
                </div>
                <ul className="divide-y divide-border/40">
                  {data.top_senders.slice(0, 5).map((s) => (
                    <li
                      key={s.address}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <a
                        href={`https://solscan.io/account/${s.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-foreground/80 hover:text-[var(--brand-up)] inline-flex items-center gap-1"
                      >
                        {s.address.slice(0, 4)}…{s.address.slice(-4)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-muted-foreground">{s.tx_count} 笔</span>
                        <span className="text-[var(--brand-up)] tabular-nums">
                          {s.total_sol.toFixed(6)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Solscan link */}
            <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-3 text-[11px]">
              <span className="text-muted-foreground/70">
                {new Date(data.computed_at).toLocaleString()}
              </span>
              <a
                href={`https://solscan.io/account/${data.fee_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--brand-up)] hover:underline"
                data-testid="fee-solscan-link"
              >
                在 Solscan 上看完整
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * 内嵌迷你柱图 · 80px 高 · 纯 SVG · 不引 recharts
 * Y 轴量 = SOL · X 轴日期(尾 5 位 MM-DD)· 柱顶 hover 显数值(title 属性)
 */
function FeeBarChart({ daily }: { daily: FeeRevenueResp['daily'] }) {
  const W = 720;
  const H = 80;
  const padL = 28, padR = 8, padT = 8, padB = 16;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = useMemo(() => Math.max(0.000001, ...daily.map((d) => d.sol)), [daily]);
  const barGap = 2;
  const barW = Math.max(1.5, innerW / daily.length - barGap);

  return (
    <div className="space-y-1" data-testid="fee-bar-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: H }}
        preserveAspectRatio="none"
      >
        {daily.map((d, i) => {
          const h = d.sol > 0 ? Math.max(1, (d.sol / max) * innerH) : 0;
          const x = padL + i * (innerW / daily.length);
          const y = padT + (innerH - h);
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={1}
                fill="#19FB9B"
                opacity={d.sol > 0 ? 0.85 : 0.15}
              >
                <title>{`${d.date} · ${d.sol.toFixed(6)} SOL · ${d.tx_count} tx`}</title>
              </rect>
            </g>
          );
        })}
        {/* 末日期标 */}
        {daily.length > 0 && (
          <text
            x={W - padR}
            y={H - 4}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={9}
            fontFamily="monospace"
          >
            {daily[daily.length - 1].date.slice(5)}
          </text>
        )}
        {/* 起始日期标 */}
        {daily.length > 1 && (
          <text
            x={padL}
            y={H - 4}
            textAnchor="start"
            className="fill-muted-foreground"
            fontSize={9}
            fontFamily="monospace"
          >
            {daily[0].date.slice(5)}
          </text>
        )}
      </svg>
    </div>
  );
}
