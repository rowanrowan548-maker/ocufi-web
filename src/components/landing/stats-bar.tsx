'use client';

/**
 * Landing · 顶部实时数据条
 *
 * 4 个公开聚合数字,从 /public/stats 拉,60s 自动刷新:
 *  - 累计成交笔数
 *  - 累计活跃钱包
 *  - 代币安全审查次数
 *  - 30 天独立访客
 *
 * Prelaunch 阶段数据可能为 0:显示 "—" 占位,布局稳定。
 * 后端未配置(NEXT_PUBLIC_API_URL 空):整个 section 不渲染。
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Repeat, Wallet, ShieldCheck, Users } from 'lucide-react';
import {
  fetchPublicStats,
  isApiConfigured,
  type PublicStats,
} from '@/lib/api-client';

const REFRESH_MS = 60_000;

export function StatsBar() {
  const t = useTranslations('landing.stats');
  const [data, setData] = useState<PublicStats | null>(null);

  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    const load = () => {
      fetchPublicStats()
        .then((s) => { if (!cancelled) setData(s); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!isApiConfigured()) return null;

  const items = [
    { Icon: Repeat,       value: data?.total_trades,           label: t('totalTrades') },
    { Icon: Wallet,       value: data?.total_wallets,          label: t('totalWallets') },
    { Icon: ShieldCheck,  value: data?.total_token_checks,     label: t('totalChecks') },
    { Icon: Users,        value: data?.unique_visitors_30d,    label: t('uniqueVisitors30d') },
  ];

  return (
    <section className="px-4 sm:px-6 py-5 border-t border-border/40 bg-muted/20">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {items.map(({ Icon, value, label }, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 bg-card p-3 sm:p-4 flex items-center gap-3"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-mono font-bold text-base sm:text-lg text-foreground tabular-nums leading-tight">
                {value == null ? '—' : value.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
