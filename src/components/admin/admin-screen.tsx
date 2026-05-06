'use client';

/**
 * 管理后台 · /admin?key=XXX
 *
 * 直接读 URL 的 key 参数请求 /admin/stats
 * 30 秒自刷新
 *
 * 不开放给搜索引擎(metadata robots: noindex);也不在 nav 里露出
 */
import { useEffect, useState } from 'react';
import {
  RefreshCw, Users, ShoppingCart, AlertCircle, Loader2, Lock,
  TrendingUp, ExternalLink, FileText, Share2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  fetchAdminStats, fetchAdminTransparencyStats, fetchAdminOgShareStats, fetchAdminV2VsV1Pv,
  isApiConfigured,
  type AdminStats, type TransparencyStatsResp, type OgShareStatsResp, type V2VsV1PvResp,
} from '@/lib/api-client';
import { DailyBarChart, HourlyHeatmap } from './admin-charts';
import { FeeRevenueCard } from './fee-revenue-card';
import { TradeVolumeCard } from './trade-volume-card';
import { BIMetricsCard } from './bi-metrics-card';

const REFRESH_MS = 30_000;

export function AdminScreen() {
  const [key, setKey] = useState<string>('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [transparency, setTransparency] = useState<TransparencyStatsResp | null>(null);
  const [ogShare, setOgShare] = useState<OgShareStatsResp | null>(null);
  const [v2v1, setV2V1] = useState<V2VsV1PvResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);

  // 取 URL 的 ?key=
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const k = new URLSearchParams(window.location.search).get('key') ?? '';
    setKey(k);
  }, []);

  async function load() {
    if (!key) return;
    if (!isApiConfigured()) {
      setError('NEXT_PUBLIC_API_URL 未配置');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 主 stats 是 hard requirement(401 → 整页错误)· 3 个 P5 endpoint 软依赖(单失败不阻塞)
      const data = await fetchAdminStats(key);
      setStats(data);
      const [tRes, oRes, vRes] = await Promise.allSettled([
        fetchAdminTransparencyStats(key),
        fetchAdminOgShareStats(key),
        fetchAdminV2VsV1Pv(key),
      ]);
      setTransparency(tRes.status === 'fulfilled' ? tRes.value : null);
      setOgShare(oRes.status === 'fulfilled' ? oRes.value : null);
      setV2V1(vRes.status === 'fulfilled' ? vRes.value : null);
      setLastRefresh(Date.now());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!key) return;
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // 没传 key
  if (!key) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md p-8 flex flex-col items-center text-center gap-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <div>
            <div className="text-base font-semibold">需要管理员密码</div>
            <div className="text-xs text-muted-foreground mt-1">
              访问方式:<span className="font-mono">/admin?key=你的密码</span>
            </div>
          </div>
          <KeyForm onSubmit={(k) => {
            const url = new URL(window.location.href);
            url.searchParams.set('key', k);
            window.location.href = url.toString();
          }} />
        </Card>
      </main>
    );
  }

  // 错误态(密码错 / 后端没配)
  if (error && !stats) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md p-8 flex flex-col items-center text-center gap-3">
          <AlertCircle className="h-10 w-10 text-danger" />
          <div className="text-sm font-medium">连接失败</div>
          <div className="text-[11px] font-mono text-muted-foreground break-all">{error}</div>
          <Button size="sm" variant="outline" onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('key');
            window.location.href = url.toString();
          }}>
            换密码
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Ocufi · 管理后台</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {stats ? '30 秒自动刷新' : 'loading…'} · 仅你能看
              {lastRefresh > 0 && (
                <> · 上次刷新 <span className="font-mono">{new Date(lastRefresh).toLocaleTimeString()}</span></>
              )}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {!stats ? (
          <Card className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </Card>
        ) : (
          <>
            {/* 6 张大数字卡 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <BigNumberCard
                Icon={Users}
                label="累计钱包"
                value={stats.total_wallets.toLocaleString()}
                delta={stats.new_wallets_24h > 0 ? `+${stats.new_wallets_24h} (24h)` : `+${stats.new_wallets_7d} (7d)`}
              />
              <BigNumberCard
                Icon={ShoppingCart}
                label="累计交易"
                value={stats.total_trades.toLocaleString()}
                delta={stats.trades_24h > 0 ? `+${stats.trades_24h} (24h)` : `+${stats.trades_7d} (7d)`}
              />
              {/* P5-FE-12 · 砍 "积分发放" + "邀请激活率"(V2 拍板隐藏)· 加 transparency 报告 + OG 分享抓取(P5-BE-1 ship 后真值)*/}
              <BigNumberCard
                Icon={FileText}
                label="transparency 报告"
                value={transparency?.ok ? transparency.total.toLocaleString() : '—'}
                delta={
                  transparency?.ok
                    ? (transparency.generated_24h > 0
                        ? `+${transparency.generated_24h} (24h)`
                        : `+${transparency.generated_7d} (7d)`)
                    : (transparency ? 'DB 不可用' : '加载中…')
                }
              />
              <BigNumberCard
                Icon={TrendingUp}
                label="留存率"
                value={`${stats.repeat_rate_pct.toFixed(1)}%`}
                delta={`${stats.repeat_wallet_count}/${stats.total_wallets} 多次成交`}
              />
              <BigNumberCard
                Icon={Share2}
                label="OG 分享抓取"
                value={ogShare?.ok ? ogShare.total_og_hits.toLocaleString() : '—'}
                delta={
                  ogShare?.ok
                    ? (ogShare.hits_24h > 0
                        ? `+${ogShare.hits_24h} (24h)`
                        : `+${ogShare.hits_7d} (7d)`)
                    : (ogShare ? 'DB 不可用' : '加载中…')
                }
              />
              <BigNumberCard
                Icon={ExternalLink}
                label="独立访客 24h"
                value={stats.unique_visitors_24h.toLocaleString()}
                delta={`PV ${stats.page_views_24h} · 7d 独立 ${stats.unique_visitors_7d}`}
              />
            </div>

            {/* T-FE-ADMIN-FEE-DASHBOARD · 0.1% 买入费聚合 · 60s 自刷 */}
            <FeeRevenueCard adminKey={key} />

            {/* T-FE-ADMIN-TRADE-VOLUME-CARD · GMV + Top 代币 · 60s 自刷 */}
            <TradeVolumeCard adminKey={key} />

            {/* T-FE-ADMIN-V1.5-DASHBOARD · BI 5 section 全套 · 60s 自刷 */}
            <BIMetricsCard adminKey={key} />

            {/* 时间序列图表 */}
            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="p-4 sm:p-5">
                <DailyBarChart
                  data={stats.daily_trades_30d}
                  label="近 30 天交易"
                  accent="#19FB9B"
                />
              </Card>
              <Card className="p-4 sm:p-5">
                <DailyBarChart
                  data={stats.daily_wallets_30d}
                  label="近 30 天新钱包"
                  accent="#7B5BFF"
                />
              </Card>
            </div>

            {/* 24 小时热度 */}
            <Card className="p-4 sm:p-5">
              <HourlyHeatmap data={stats.hourly_activity_24h} />
            </Card>

            {/* 访客图表 */}
            <Card className="p-4 sm:p-5">
              <DailyBarChart
                data={stats.daily_views_30d}
                label="近 30 天页面浏览(PV)"
                accent="#5BC8FF"
              />
            </Card>

            {/* P5-FE-12 改 3 · V2 vs V1 PV 对比卡(P5-BE-1 改 2)*/}
            <V2VsV1Card data={v2v1} />

            {/* Top 页面 + Top 来源 + 设备 */}
            <div className="grid lg:grid-cols-3 gap-4">
              <Card>
                <div className="px-5 py-3 border-b border-border/40">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Top 10 热门页面 (7d)</div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>路径</TableHead>
                        <TableHead className="text-right">PV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.top_pages.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground/60 py-8">暂无</TableCell></TableRow>
                      ) : stats.top_pages.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs truncate max-w-[180px]">{p.path}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{p.views.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card>
                <div className="px-5 py-3 border-b border-border/40">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Top 10 流量来源 (7d)</div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>来源</TableHead>
                        <TableHead className="text-right">访问</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.top_referrers.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground/60 py-8">暂无 / 全部直接访问</TableCell></TableRow>
                      ) : stats.top_referrers.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs truncate max-w-[180px]">{r.host}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{r.views.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card>
                <div className="px-5 py-3 border-b border-border/40">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">设备分布 (7d)</div>
                </div>
                <div className="p-5 space-y-3">
                  {stats.device_breakdown.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground/60 py-8">暂无</div>
                  ) : (() => {
                    const totalDev = stats.device_breakdown.reduce((s, d) => s + d.count, 0);
                    return stats.device_breakdown.map((d, i) => {
                      const pct = totalDev > 0 ? (d.count / totalDev) * 100 : 0;
                      const colors: Record<string, string> = {
                        desktop: 'bg-primary/60',
                        mobile: 'bg-[#5BC8FF]/60',
                        tablet: 'bg-warning/60',
                      };
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-mono">{d.device}</span>
                            <span className="font-mono text-muted-foreground">
                              {d.count.toLocaleString()} <span className="text-[10px]">({pct.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${colors[d.device] || 'bg-muted-foreground/40'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Card>
            </div>

            {/* P5-FE-12 · 砍 "Top 10 邀请人"(V2 隐藏邀请 · 永远空表)· 仅留 Top 10 积分钱包 */}
            <div className="grid gap-4">
              <Card>
                <div className="px-5 py-3 border-b border-border/40">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Top 10 积分钱包</div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>钱包</TableHead>
                        <TableHead className="text-right">积分</TableHead>
                        <TableHead className="text-right">事件数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.top_traders.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground/60 py-8">暂无</TableCell></TableRow>
                      ) : stats.top_traders.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.wallet_short}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{r.points.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{r.trade_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>

            {/* 最近事件流 */}
            <Card>
              <div className="px-5 py-3 border-b border-border/40">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  最近 {stats.recent_events.length} 笔积分事件
                </div>
              </div>
              <div className="overflow-x-auto max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>钱包</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead className="text-right">积分</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recent_events.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground/60 py-8">暂无</TableCell></TableRow>
                    ) : stats.recent_events.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">
                          {new Date(r.at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.wallet_short}</TableCell>
                        <TableCell>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {r.event_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-success">
                          +{r.amount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <div className="text-[10px] text-muted-foreground/60 text-center pt-2">
              数据来自 ocufi-api · 链上交易在 Solscan 自行核对
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function V2VsV1Card({ data }: { data: V2VsV1PvResp | null }) {
  if (!data) {
    return (
      <Card className="p-4 sm:p-5 text-center text-xs text-muted-foreground/60">
        V2 vs V1 PV · 加载中…
      </Card>
    );
  }
  if (!data.ok) {
    return (
      <Card className="p-4 sm:p-5 text-center text-xs text-muted-foreground/60">
        V2 vs V1 PV · DB 不可用
      </Card>
    );
  }
  const total = data.v2_pv + data.v1_pv;
  const v2Pct = data.v2_share_pct;
  const v1Pct = total > 0 ? Math.max(0, 100 - v2Pct) : 0;
  return (
    <Card>
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          V2 vs V1 PV(7 天)
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          总 PV {total.toLocaleString()}
        </div>
      </div>
      <div className="p-5 space-y-4">
        {/* 横向对比柱 */}
        <div className="space-y-2">
          <PvBar
            label="V2"
            count={data.v2_pv}
            pct={v2Pct}
            color="bg-[#19FB9B]/70"
            tone="text-[#19FB9B]"
          />
          <PvBar
            label="V1"
            count={data.v1_pv}
            pct={v1Pct}
            color="bg-[#5BC8FF]/60"
            tone="text-[#5BC8FF]"
          />
        </div>

        {/* Top paths · 双列 */}
        <div className="grid sm:grid-cols-2 gap-4">
          <PvTopList title="V2 Top 10 路径" rows={data.v2_top_paths} accent="text-[#19FB9B]" />
          <PvTopList title="V1 Top 10 路径" rows={data.v1_top_paths} accent="text-[#5BC8FF]" />
        </div>
      </div>
    </Card>
  );
}

function PvBar({
  label, count, pct, color, tone,
}: {
  label: string;
  count: number;
  pct: number;
  color: string;
  tone: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-mono font-semibold ${tone}`}>{label}</span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {count.toLocaleString()} <span className="text-[10px]">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function PvTopList({
  title, rows, accent,
}: {
  title: string;
  rows: { path: string; views: number }[];
  accent: string;
}) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider mb-1.5 ${accent}`}>{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground/60 py-2">暂无</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] truncate">{r.path}</span>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {r.views.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BigNumberCard({
  Icon, label, value, delta, href,
}: {
  Icon: typeof Users;
  label: string;
  value: string;
  delta?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums mt-2">
        {value}
      </div>
      {delta && (
        <div className="text-[10px] font-mono text-success/80 mt-1">{delta}</div>
      )}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block transition-colors hover:bg-muted/30 rounded-xl"
      >
        <Card className="p-4 sm:p-5">{content}</Card>
      </a>
    );
  }
  return <Card className="p-4 sm:p-5">{content}</Card>;
}

function KeyForm({ onSubmit }: { onSubmit: (k: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (v) onSubmit(v); }}
      className="w-full flex gap-2"
    >
      <input
        type="password"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="ADMIN_KEY"
        className="flex-1 h-10 px-3 rounded-md border border-border/60 bg-background text-sm font-mono focus:outline-none focus:border-primary/50"
        autoFocus
      />
      <Button type="submit" size="sm">进入</Button>
    </form>
  );
}
