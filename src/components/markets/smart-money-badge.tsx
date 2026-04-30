'use client';

/**
 * T-MARKETS-DIFFER-V2 · 聪明钱标
 *
 * 行级 IntersectionObserver 懒加载 /markets/smart-money?mint=X
 *  · 跨行模块缓存 + inflight dedup(在 markets-smart-money.ts)
 *  · count>0 显示 "💰 N 个聪明钱在买" + hover tooltip 列 top 3 buyer
 *  · count==0 / 失败 → 不渲染(空字符串占位 · 不打扰行布局)
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Wallet } from 'lucide-react';
import { fetchSmartMoney, type SmartMoneyResp } from '@/lib/markets-smart-money';
import { isApiConfigured } from '@/lib/api-client';

interface Props {
  mint: string;
}

export function SmartMoneyBadge({ mint }: Props) {
  const t = useTranslations('markets.smartMoney');
  const ref = useRef<HTMLSpanElement>(null);
  const [data, setData] = useState<SmartMoneyResp | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isApiConfigured()) return;
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    let triggered = false;

    const fire = () => {
      if (triggered) return;
      triggered = true;
      fetchSmartMoney(mint).then((r) => {
        if (!cancelled) setData(r);
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      fire();
      return () => { cancelled = true; };
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { fire(); io.disconnect(); break; }
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [mint]);

  // 加载中 / 没数据 → 占位空 span 给 IO 挂
  if (!data || data.count <= 0) {
    return <span ref={ref} className="inline-block w-4 h-4" data-testid="smart-money-badge-empty" />;
  }

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center gap-1 text-[11px] font-mono text-[var(--brand-up)] cursor-help"
      data-testid="smart-money-badge"
      data-count={data.count}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-label={t('label', { count: data.count })}
    >
      <Wallet className="h-3 w-3" />
      <span>{data.count}</span>

      {open && data.recent_buyers.length > 0 && (
        <span
          role="tooltip"
          data-testid="smart-money-tooltip"
          className="absolute right-0 top-full mt-1 z-50 w-[260px] rounded-md border border-border/60 bg-popover text-popover-foreground shadow-lg p-2 text-left"
          onMouseEnter={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            {t('topBuyers')}
          </div>
          <ul className="space-y-1">
            {data.recent_buyers.slice(0, 3).map((b) => (
              <li key={b.wallet} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-mono truncate">{shortAddr(b.wallet)}</span>
                <span className="font-mono whitespace-nowrap text-muted-foreground">
                  {b.profit_30d_usd != null && (
                    <span className="text-[var(--brand-up)] mr-1">
                      +${formatCompact(b.profit_30d_usd)}
                    </span>
                  )}
                  ${formatCompact(b.buy_amount_usd)}
                </span>
              </li>
            ))}
          </ul>
          <div className="text-[9px] text-muted-foreground/70 mt-1.5 pt-1 border-t border-border/40">
            {t('tooltipHint')}
          </div>
        </span>
      )}
    </span>
  );
}

function shortAddr(a: string): string {
  if (!a) return '';
  if (a.length <= 10) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}
