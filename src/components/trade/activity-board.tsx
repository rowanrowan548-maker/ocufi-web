'use client';

/**
 * 交易活动面板 · gmgn 风
 *
 * tabs:
 *  - 活动:GeckoTerminal 拉最近 100 笔成交
 *  - 订单:占位(限价单聚合,Day 13+)
 *  - 持有者:链上 getProgramAccounts 拉前 100,失败回落 RugCheck topHolders
 *  - 风险明细:RugCheck risks
 */
import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity, ListOrdered, Users, AlertTriangle, Wallet, Construction,
  ExternalLink, ArrowUpRight, ArrowDownLeft, Loader2,
} from 'lucide-react';
import type { TokenDetail } from '@/lib/token-info';
import { getCurrentChain } from '@/config/chains';
import { fetchMintTrades, type GTTrade } from '@/lib/geckoterminal';
import { fetchTopHolders, type Holder } from '@/lib/holders';

interface Props {
  detail: TokenDetail | null;
}

const ACTIVITY_REFRESH_MS = 30_000;

export function ActivityBoard({ detail }: Props) {
  const t = useTranslations('trade.activity');
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const [tab, setTab] = useState('activity');

  const mint = detail?.mint;

  // ── 活动:GeckoTerminal trades(30s 自动刷新) ──
  const [trades, setTrades] = useState<GTTrade[] | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  useEffect(() => {
    if (!mint) {
      setTrades(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setTradesLoading(true);
      const list = await fetchMintTrades(mint, 100);
      if (!cancelled) {
        setTrades(list);
        setTradesLoading(false);
      }
    };
    load();
    const id = setInterval(load, ACTIVITY_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [mint]);

  // ── 持有者:链上拉前 100,失败回落 RugCheck ──
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [holdersLoading, setHoldersLoading] = useState(false);
  useEffect(() => {
    if (!mint || tab !== 'holders') return;
    if (holders && holders.length > 0) return; // 已经有数据
    let cancelled = false;
    setHoldersLoading(true);
    fetchTopHolders(connection, mint, 20)
      .then((h) => { if (!cancelled) setHolders(h); })
      .finally(() => { if (!cancelled) setHoldersLoading(false); });
    return () => { cancelled = true; };
  }, [mint, tab, connection, holders]);

  // mint 切换重置
  useEffect(() => {
    setHolders(null);
  }, [mint]);

  return (
    <Card className="p-4">
      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList className="bg-transparent border-b border-border/40 rounded-none w-full justify-start gap-5 px-0 mb-4 h-auto overflow-x-auto">
          <TabBtn value="activity" Icon={Activity}>
            {t('activity')}{trades?.length ? ` ${trades.length}` : ''}
          </TabBtn>
          <TabBtn value="orders" Icon={ListOrdered}>{t('orders')}</TabBtn>
          <TabBtn value="holders" Icon={Users}>
            {t('holders')}
            {detail?.totalHolders ? ` ${detail.totalHolders.toLocaleString()}` : ''}
          </TabBtn>
          <TabBtn value="risks" Icon={AlertTriangle}>
            {t('risks')}{detail?.risks?.length ? ` ${detail.risks.length}` : ''}
          </TabBtn>
        </TabsList>

        {/* ── 活动 ── */}
        <TabsContent value="activity">
          {!mint ? (
            <Empty Icon={Construction} title={t('comingSoon.activity.title')} subtitle={t('comingSoon.activity.subtitle')} />
          ) : tradesLoading && !trades ? (
            <LoadingRow />
          ) : trades && trades.length > 0 ? (
            <div className="text-xs">
              {/* 表头 */}
              <div className="grid grid-cols-[60px_1fr_1fr_50px] gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                <span>{t('cols.side')}</span>
                <span className="text-right">{t('cols.usd')}</span>
                <span>{t('cols.maker')}</span>
                <span className="text-right">{t('cols.time')}</span>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {trades.slice(0, 100).map((tr) => (
                  <TradeRow key={tr.txSignature} tr={tr} explorer={chain.explorer} />
                ))}
              </div>
            </div>
          ) : (
            <Empty Icon={Activity} title={t('noActivity.title')} subtitle={t('noActivity.subtitle')} />
          )}
        </TabsContent>

        {/* ── 订单 ── */}
        <TabsContent value="orders">
          <Empty Icon={Wallet} title={t('comingSoon.orders.title')} subtitle={t('comingSoon.orders.subtitle')} />
        </TabsContent>

        {/* ── 持有者 ── */}
        <TabsContent value="holders">
          {!mint ? (
            <Empty Icon={Users} title={t('comingSoon.holders.title')} subtitle={t('comingSoon.holders.subtitle')} />
          ) : holdersLoading ? (
            <LoadingRow />
          ) : holders && holders.length > 0 ? (
            <div className="space-y-1 text-xs max-h-[480px] overflow-y-auto">
              {/* 表头 */}
              <div className="grid grid-cols-[40px_1fr_60px] gap-2 px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium sticky top-0 bg-card">
                <span>#</span>
                <span>{t('cols.owner')}</span>
                <span className="text-right">{t('cols.pct')}</span>
              </div>
              {holders.map((h, i) => (
                <HolderRow
                  key={h.account}
                  rank={i + 1}
                  holder={h}
                  explorer={chain.explorer}
                  maxPct={holders[0]?.pct ?? 0}
                />
              ))}
            </div>
          ) : detail?.topHolders && detail.topHolders.length > 0 ? (
            // 链上失败,降级显示 RugCheck
            <div className="space-y-1 text-xs">
              {detail.topHolders.slice(0, 100).map((h, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_60px] gap-2 py-1 border-b border-border/30 last:border-b-0">
                  <span className="font-mono text-muted-foreground">#{i + 1}</span>
                  <span className="font-mono text-muted-foreground/80 truncate">
                    {h.address ? `${h.address.slice(0, 6)}…${h.address.slice(-4)}` : '—'}
                  </span>
                  <span className="font-mono text-right">{(h.pct ?? 0).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty Icon={Users} title={t('comingSoon.holders.title')} subtitle={t('comingSoon.holders.subtitle')} />
          )}
        </TabsContent>

        {/* ── 风险明细 ── */}
        <TabsContent value="risks">
          {detail?.risks && detail.risks.length > 0 ? (
            <div className="space-y-2">
              {detail.risks.map((r, i) => (
                <div
                  key={i}
                  className={[
                    'flex gap-2 p-2.5 rounded-md text-xs',
                    r.level === 'danger'
                      ? 'bg-danger/10 text-danger border border-danger/20'
                      : r.level === 'warn'
                      ? 'bg-warning/10 text-warning border border-warning/20'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{safeText(r.name)}</div>
                    {r.description && (
                      <div className="text-[11px] mt-0.5 opacity-80">
                        {safeText(r.description)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty Icon={AlertTriangle} title={t('noRisks.title')} subtitle={t('noRisks.subtitle')} />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function TradeRow({ tr, explorer }: { tr: GTTrade; explorer: string }) {
  const isBuy = tr.kind === 'buy';
  const sideColor = isBuy ? 'text-success' : 'text-danger';
  const SideIcon = isBuy ? ArrowDownLeft : ArrowUpRight;
  return (
    <a
      href={tr.txSignature ? `${explorer}/tx/${tr.txSignature}` : '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[60px_1fr_1fr_50px] gap-2 px-2 py-1.5 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0"
    >
      <span className={`flex items-center gap-1 font-medium ${sideColor}`}>
        <SideIcon className="h-3 w-3" />
        {isBuy ? 'BUY' : 'SELL'}
      </span>
      <span className="text-right font-mono">
        ${formatCompact(tr.usdValue)}
      </span>
      <span className="font-mono text-muted-foreground/70 truncate">
        {tr.fromAddress ? `${tr.fromAddress.slice(0, 4)}…${tr.fromAddress.slice(-4)}` : '—'}
      </span>
      <span className="text-right text-muted-foreground/60 text-[10px]">
        {timeAgo(tr.blockTimestampMs)}
      </span>
    </a>
  );
}

function HolderRow({
  rank, holder, explorer, maxPct,
}: {
  rank: number;
  holder: Holder;
  decimals?: number;
  explorer: string;
  maxPct: number;
}) {
  const owner = holder.owner;
  // 柱状图宽度按 maxPct(top1)归一化,top1 = 100% bar 宽度
  const barWidth = maxPct > 0 ? Math.max(2, (holder.pct / maxPct) * 100) : 0;
  // 单一持有占比颜色:>50% 红 / >20% 黄 / <20% 绿
  const barColor =
    holder.pct > 50 ? 'bg-danger/40' : holder.pct > 20 ? 'bg-warning/50' : 'bg-primary/40';

  return (
    <a
      href={owner ? `${explorer}/account/${owner}` : '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[40px_1fr_60px] gap-2 px-1 py-1.5 hover:bg-muted/30 transition-colors text-xs"
    >
      <span className="font-mono text-muted-foreground">#{rank}</span>
      <div className="min-w-0 flex flex-col gap-1">
        <span className="font-mono text-muted-foreground/80 truncate flex items-center gap-1">
          {owner ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : '—'}
          {owner && <ExternalLink className="h-2.5 w-2.5 opacity-50" />}
        </span>
        {/* 占比柱(归一化到 top1) */}
        <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <span className="font-mono text-right tabular-nums">{holder.pct.toFixed(2)}%</span>
    </a>
  );
}

function LoadingRow() {
  return (
    <div className="py-12 flex items-center justify-center text-muted-foreground text-xs gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      loading…
    </div>
  );
}

/** 安全文本:剥离控制字符 + 截断,防外部 API 注入超长/恶意字符串 */
function safeText(s: string, max = 200): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

function timeAgo(ms: number): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function TabBtn({ value, Icon, children }: { value: string; Icon: typeof Activity; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="px-0 py-2 rounded-none border-b-2 border-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground data-[selected=true]:border-primary text-muted-foreground gap-1.5"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs whitespace-nowrap">{children}</span>
    </TabsTrigger>
  );
}

function Empty({ Icon, title, subtitle }: { Icon: typeof Activity; title: string; subtitle: string }) {
  return (
    <div className="py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="text-xs text-muted-foreground/60 mt-1">{subtitle}</div>
    </div>
  );
}
