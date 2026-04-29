'use client';

/**
 * T-MARKETS-PAGE-V1 · /markets 主表
 *
 * 列:代币 / 价格 / 5m / 1h / 24h / 流动性 / 市值 / 24h 量 / 池龄 / (风险标)
 *
 * 风险标行级懒加载:
 *  - showRisk=true 时显示风险列(verified / risk tab)
 *  - 用 IntersectionObserver 每行进视口才 fetchTokenAuditCard
 *  - 失败/未加载 → 灰圆点 · 加载完按 honeypot/lp_burn/top10 给颜色
 *
 * 行交互:点击 → /trade?mint=X · hover 高亮
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ShieldCheck, ShieldAlert, ShieldX, Shield, Loader2 } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  fetchTokenAuditCard,
  isApiConfigured,
  type MarketItem,
  type TokenAuditCard,
} from '@/lib/api-client';
import { isVerifiedToken } from '@/lib/verified-tokens';

interface Props {
  items: MarketItem[];
  /** verified / risk tab 才显示风险列 */
  showRisk?: boolean;
}

export function MarketsTable({ items, showRisk = false }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1100px]">
        <TableHeader>
          <TableRow>
            <ColHead>代币</ColHead>
            <ColHead align="right">价格</ColHead>
            <ColHead align="right">5m</ColHead>
            <ColHead align="right">1h</ColHead>
            <ColHead align="right">24h</ColHead>
            <ColHead align="right" mdOnly>流动性</ColHead>
            <ColHead align="right" mdOnly>市值</ColHead>
            <ColHead align="right" lgOnly>24h 量</ColHead>
            <ColHead align="right" lgOnly>池龄</ColHead>
            {showRisk && <ColHead align="center">风险</ColHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <Row key={it.mint} it={it} showRisk={showRisk} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ColHead({
  children, align, mdOnly, lgOnly,
}: {
  children: React.ReactNode;
  align?: 'right' | 'center';
  mdOnly?: boolean;
  lgOnly?: boolean;
}) {
  const cls = [
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '',
    mdOnly ? 'hidden md:table-cell' : '',
    lgOnly ? 'hidden lg:table-cell' : '',
  ].filter(Boolean).join(' ');
  return <TableHead className={cls}>{children}</TableHead>;
}

function Row({ it, showRisk }: { it: MarketItem; showRisk: boolean }) {
  return (
    <TableRow
      data-testid="markets-row"
      data-mint={it.mint}
      className="hover:bg-muted/30 transition-colors"
    >
      <TableCell>
        <Link href={`/trade?mint=${it.mint}`} className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {it.logo ? (
              <Image src={it.logo} alt={it.symbol} width={32} height={32} className="object-cover" unoptimized />
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground">
                {it.symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{it.symbol}</div>
            {it.name && it.name !== it.symbol && (
              <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">{it.name}</div>
            )}
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm whitespace-nowrap">
        {it.priceUsd != null ? `$${formatPrice(it.priceUsd)}` : '—'}
      </TableCell>
      <TableCell className="text-right">
        <ChangePill pct={it.change5m} />
      </TableCell>
      <TableCell className="text-right">
        <ChangePill pct={it.change1h} />
      </TableCell>
      <TableCell className="text-right">
        <ChangePill pct={it.change24h} />
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell whitespace-nowrap">
        {it.liquidityUsd != null ? `$${formatCompact(it.liquidityUsd)}` : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell whitespace-nowrap">
        {it.marketCapUsd != null ? `$${formatCompact(it.marketCapUsd)}` : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden lg:table-cell whitespace-nowrap">
        {it.volumeH24 != null ? `$${formatCompact(it.volumeH24)}` : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-[11px] text-muted-foreground hidden lg:table-cell whitespace-nowrap">
        {formatAge(it.ageHours)}
      </TableCell>
      {showRisk && (
        <TableCell className="text-center">
          <RiskBadge mint={it.mint} />
        </TableCell>
      )}
    </TableRow>
  );
}

/** IntersectionObserver 行级懒加载 audit-card · 进视口 1 次 fetch · 跨行共享缓存 */
const auditCache = new Map<string, TokenAuditCard | 'error'>();
const auditInflight = new Map<string, Promise<TokenAuditCard | 'error'>>();

function getAudit(mint: string): Promise<TokenAuditCard | 'error'> {
  const c = auditCache.get(mint);
  if (c) return Promise.resolve(c);
  let p = auditInflight.get(mint);
  if (!p) {
    p = fetchTokenAuditCard(mint)
      .then((d) => { auditCache.set(mint, d); return d as TokenAuditCard | 'error'; })
      .catch(() => { auditCache.set(mint, 'error'); return 'error' as const; })
      .finally(() => { auditInflight.delete(mint); });
    auditInflight.set(mint, p);
  }
  return p;
}

function RiskBadge({ mint }: { mint: string }) {
  const t = useTranslations('markets.risk');
  const ref = useRef<HTMLSpanElement>(null);
  const [audit, setAudit] = useState<TokenAuditCard | null>(null);
  const [errored, setErrored] = useState(false);
  const [loading, setLoading] = useState(false);

  // 已审白名单 → 直接显示 ✓ · 不打 audit-card
  const verified = useMemo(() => isVerifiedToken(mint), [mint]);

  useEffect(() => {
    if (verified) return;
    if (!isApiConfigured()) return;
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    let triggered = false;

    const fire = () => {
      if (triggered) return;
      triggered = true;
      setLoading(true);
      getAudit(mint).then((r) => {
        if (cancelled) return;
        if (r === 'error') setErrored(true);
        else setAudit(r);
        setLoading(false);
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      // SSR / 老浏览器 → 直接 fetch
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
  }, [mint, verified]);

  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--brand-up)]" title={t('verified')}>
        <ShieldCheck className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span ref={ref} className="inline-flex items-center justify-center" data-testid="risk-badge">
      {loading && !audit ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
      ) : errored ? (
        <Shield className="h-4 w-4 text-muted-foreground/40" aria-label={t('unknown')} />
      ) : audit ? (
        <RiskIcon audit={audit} t={t} />
      ) : (
        <Shield className="h-4 w-4 text-muted-foreground/30" aria-label={t('pending')} />
      )}
    </span>
  );
}

function RiskIcon({
  audit, t,
}: {
  audit: TokenAuditCard;
  t: ReturnType<typeof useTranslations>;
}) {
  // 风险等级判定(spec 中蜜罐字段后端暂未返,用现有字段近似):
  //  bad  · top10>=40 / rats>=15 / bundle>=15 / sniper>=10 / dev=active / lp<80 → 红
  //  warn · 中间档                                                              → 黄
  //  good · 全绿且 lp>=99                                                       → 绿
  const top10 = audit.top10_pct;
  const rats = audit.rat_warehouse_pct;
  const bundle = audit.bundle_pct;
  const sniper = audit.sniper_pct;
  const lp = audit.lp_burn_pct;
  const dev = audit.dev_status;

  const badHits =
    (top10 != null && top10 >= 40 ? 1 : 0)
    + (rats != null && rats >= 15 ? 1 : 0)
    + (bundle != null && bundle >= 15 ? 1 : 0)
    + (sniper != null && sniper >= 10 ? 1 : 0)
    + (dev === 'active' ? 1 : 0)
    + (lp != null && lp < 80 ? 1 : 0);

  const warnHits =
    (top10 != null && top10 >= 20 && top10 < 40 ? 1 : 0)
    + (rats != null && rats >= 5 && rats < 15 ? 1 : 0)
    + (bundle != null && bundle >= 5 && bundle < 15 ? 1 : 0)
    + (sniper != null && sniper >= 5 && sniper < 10 ? 1 : 0)
    + (lp != null && lp >= 80 && lp < 99 ? 1 : 0);

  if (badHits > 0) {
    return (
      <ShieldX
        className="h-4 w-4 text-[var(--brand-down)]"
        aria-label={t('risky')}
        data-tone="bad"
      />
    );
  }
  if (warnHits > 0) {
    return (
      <ShieldAlert
        className="h-4 w-4 text-amber-500"
        aria-label={t('warn')}
        data-tone="warn"
      />
    );
  }
  return (
    <ShieldCheck
      className="h-4 w-4 text-[var(--brand-up)]"
      aria-label={t('safe')}
      data-tone="good"
    />
  );
}

function ChangePill({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground/50">—</span>;
  const up = pct > 0;
  const down = pct < 0;
  const cls = up
    ? 'text-[var(--brand-up)]'
    : down
      ? 'text-[var(--brand-down)]'
      : 'text-muted-foreground';
  return (
    <span className={`text-xs font-mono whitespace-nowrap ${cls}`}>
      {up ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function formatPrice(n: number): string {
  if (!n) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  const fixed = n.toFixed(20);
  const m = fixed.match(/^0\.(0+)(\d+)/);
  if (!m) return n.toPrecision(3);
  const lead = m[1].length;
  if (lead < 4) return `0.${m[1]}${m[2].slice(0, 4)}`;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return `0.0${String(lead).split('').map((d) => subs[+d]).join('')}${m[2].slice(0, 4)}`;
}

function formatCompact(n: number): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

function formatAge(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  if (hours < 24 * 30) return `${(hours / 24).toFixed(0)}d`;
  return `${(hours / (24 * 30)).toFixed(0)}mo`;
}
