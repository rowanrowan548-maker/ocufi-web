'use client';

/**
 * T-FE-ADMIN-TRADE-VOLUME-CARD · /admin GMV + Top 代币
 *
 * 数据源:GET /admin/trade-volume?window=24h|7d|30d|all
 * 鉴权:X-Admin-Key(从 admin-screen 拿到的 ?key= URL param)
 * 刷新:60s 自刷
 *
 * UI(从上到下):
 *   1. 标题 + 4 chip 窗口选择(WindowSelector 共享)
 *   2. 大数字:total_volume_usd · total_trades 笔 · 平均 $X.XX
 *   3. 买卖比饼图(SVG donut · 绿 #19FB9B / 红 #FF6B6B · 不引 recharts)
 *   4. Top 10 代币表(logo + symbol + 笔数 + USD)
 *   5. computed_at 时间戳
 *
 * 跟 fee-revenue-card 一致 · 不引 SWR · 不做 i18n(/admin 全 hardcoded zh)
 */
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  fetchAdminTradeVolume,
  type FeeRevenueWindow,
  type TradeVolumeResp,
} from '@/lib/api-client';
import { WindowSelector } from './window-selector';

const REFRESH_MS = 60_000;

export function TradeVolumeCard({ adminKey }: { adminKey: string }) {
  const [window, setWindow] = useState<FeeRevenueWindow>('7d');
  const [data, setData] = useState<TradeVolumeResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchAdminTradeVolume(adminKey, window);
      setData(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [adminKey, window]);

  useEffect(() => {
    // 跟 admin-screen / fee-revenue-card 一致的 60s 自刷模式
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Card className="overflow-hidden" data-testid="admin-trade-volume-card">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--brand-up)]" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            交易量(GMV)
          </span>
        </div>
        <WindowSelector value={window} onChange={setWindow} testIdPrefix="volume-window" />
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
            {/* 大数字行 · GMV + 笔数 + 均价 */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <div
                className="font-mono text-3xl sm:text-4xl font-bold tabular-nums text-[var(--brand-up)]"
                data-testid="volume-total-usd"
              >
                ${data.total_volume_usd.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground" data-testid="volume-tx-count">
                · {data.total_trades.toLocaleString()} 笔
              </div>
              <div className="text-xs text-muted-foreground/70" data-testid="volume-avg">
                · 均 ${data.avg_trade_usd.toFixed(2)}/笔
              </div>
              {loading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
              )}
            </div>

            {/* 买卖比 · SVG donut · 仅有量时显示 */}
            {(data.buy_count + data.sell_count) > 0 && (
              <BuySellDonut buyCount={data.buy_count} sellCount={data.sell_count} />
            )}

            {/* Top 10 代币 */}
            {data.top_tokens.length > 0 ? (
              <div data-testid="volume-top-tokens">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Top {Math.min(10, data.top_tokens.length)} 代币
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>代币</TableHead>
                        <TableHead className="text-right">笔数</TableHead>
                        <TableHead className="text-right">USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_tokens.slice(0, 10).map((t) => (
                        <TableRow key={t.mint} data-testid="volume-top-token-row" data-mint={t.mint}>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                                {t.logo_url ? (
                                  <Image
                                    src={t.logo_url}
                                    alt={t.symbol}
                                    width={24}
                                    height={24}
                                    className="object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <span className="text-[8px] font-bold text-muted-foreground">
                                    {t.symbol.slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-medium truncate max-w-[120px]">
                                {t.symbol}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {t.trade_count.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-[var(--brand-up)] tabular-nums">
                            ${t.volume_usd.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground/60 py-4">
                暂无代币数据
              </div>
            )}

            {/* 时间戳 */}
            <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground/70">
              {new Date(data.computed_at).toLocaleString()}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * 买卖比 SVG donut · 不引 recharts
 * 绿(买)= #19FB9B / 红(卖)= #FF6B6B
 */
function BuySellDonut({ buyCount, sellCount }: { buyCount: number; sellCount: number }) {
  const total = buyCount + sellCount;
  const buyPct = total > 0 ? (buyCount / total) * 100 : 0;
  const sellPct = 100 - buyPct;

  // donut 几何:r=40 · stroke=12 · 外径 ≈52 · viewBox 120×120
  const cx = 60, cy = 60, r = 40;
  const C = 2 * Math.PI * r; // 周长
  const buyDash = (buyPct / 100) * C;
  const sellDash = (sellPct / 100) * C;

  return (
    <div className="flex items-center gap-5" data-testid="volume-buysell-donut">
      <svg viewBox="0 0 120 120" className="w-24 h-24 flex-shrink-0" aria-label="买卖比例">
        {/* 底圈 */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--muted)" strokeOpacity={0.2} strokeWidth={12} />
        {/* 卖(红) · 整圈 · 上面盖买的部分 */}
        {sellCount > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#FF6B6B"
            strokeWidth={12}
            strokeDasharray={`${sellDash} ${C - sellDash}`}
            strokeDashoffset={-buyDash}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        )}
        {/* 买(绿) · 0 → buyDash */}
        {buyCount > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#19FB9B"
            strokeWidth={12}
            strokeDasharray={`${buyDash} ${C - buyDash}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        )}
        {/* 中心数字 */}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize={16}
          fontFamily="monospace"
          fontWeight="600"
          fill="currentColor"
        >
          {total}
        </text>
      </svg>
      <div className="space-y-1.5 text-xs">
        <Legend color="#19FB9B" label="买" count={buyCount} pct={buyPct} testId="legend-buy" />
        <Legend color="#FF6B6B" label="卖" count={sellCount} pct={sellPct} testId="legend-sell" />
      </div>
    </div>
  );
}

function Legend({
  color, label, count, pct, testId,
}: {
  color: string;
  label: string;
  count: number;
  pct: number;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-2 font-mono" data-testid={testId}>
      <span
        className="inline-block h-3 w-3 rounded-sm flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-foreground/80 min-w-[1.5rem]">{label}</span>
      <span className="text-foreground tabular-nums">{count}</span>
      <span className="text-muted-foreground tabular-nums">({pct.toFixed(0)}%)</span>
    </div>
  );
}
