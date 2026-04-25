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
  RefreshCw, Users, ShoppingCart, Coins, Sparkles, AlertCircle, Loader2, Lock,
  TrendingUp, ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { fetchAdminStats, isApiConfigured, type AdminStats } from '@/lib/api-client';
import { DailyBarChart, HourlyHeatmap } from './admin-charts';

const REFRESH_MS = 30_000;

export function AdminScreen() {
  const [key, setKey] = useState<string>('');
  const [stats, setStats] = useState<AdminStats | null>(null);
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
      const data = await fetchAdminStats(key);
      setStats(data);
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
              <BigNumberCard
                Icon={Coins}
                label="积分发放"
                value={stats.total_points_awarded.toLocaleString()}
                delta={stats.points_24h > 0 ? `+${stats.points_24h} (24h)` : ''}
              />
              <BigNumberCard
                Icon={TrendingUp}
                label="留存率"
                value={`${stats.repeat_rate_pct.toFixed(1)}%`}
                delta={`${stats.repeat_wallet_count}/${stats.total_wallets} 多次成交`}
              />
              <BigNumberCard
                Icon={Sparkles}
                label="邀请激活率"
                value={`${stats.activation_rate_pct.toFixed(1)}%`}
                delta={`${stats.invite_activated}/${stats.invite_bound}`}
              />
              <BigNumberCard
                Icon={ExternalLink}
                label="访客流量"
                value="去 Vercel"
                delta="点开新窗口"
                href="https://vercel.com/dashboard"
              />
            </div>

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

            {/* Top 邀请人 + Top 积分钱包 */}
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <div className="px-5 py-3 border-b border-border/40">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Top 10 邀请人</div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>钱包</TableHead>
                        <TableHead className="text-right">已邀</TableHead>
                        <TableHead className="text-right">已激活</TableHead>
                        <TableHead className="text-right">分成积分</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.top_inviters.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground/60 py-8">暂无</TableCell></TableRow>
                      ) : stats.top_inviters.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.wallet_short}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{r.invited}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-success">{r.activated}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{r.earned.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

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
