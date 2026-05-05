'use client';

/**
 * T-OKX-1C-fe · 6 项审计卡组(GMGN/OKX 杀手特色)
 *
 * 后端: GET /token/audit-card?mint=  返 6 字段(可空)
 * 配色规则(spec):
 *   Top 10:        <20% 绿 / <40% 黄 / >=40% 红
 *   老鼠仓:        null 灰 / <5% 绿 / <15% 黄 / >=15% 红
 *   开发者:        cleared 橙 / holding 绿 / active 红 / null 灰
 *   捆绑交易者:    <5% 绿 / <15% 黄 / >=15% 红
 *   狙击手:        <5% 绿 / >=10% 红 / 中间黄
 *   烧池子:        >=99 绿 / >=80 黄 / <80 红
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Bug, UserCog, Package, Crosshair, Flame, type LucideIcon } from 'lucide-react';
import { fetchTokenAuditCard, isApiConfigured, type TokenAuditCard } from '@/lib/api-client';
import { StaleBar } from './stale-bar';

interface Props {
  mint: string;
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export function AuditCards({ mint }: Props) {
  const t = useTranslations('trade.audit');
  const [data, setData] = useState<TokenAuditCard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mint || !isApiConfigured()) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    fetchTokenAuditCard(mint)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mint]);

  if (!mint) return null;

  if (loading && !data) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-muted/40 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  const top10 = data?.top10_pct ?? null;
  const rats = data?.rat_warehouse_pct ?? null;
  const dev = data?.dev_status ?? null;
  const bundle = data?.bundle_pct ?? null;
  const sniper = data?.sniper_pct ?? null;
  const lp = data?.lp_burn_pct ?? null;

  const top10Tone: Tone = top10 === null ? 'neutral' : top10 < 20 ? 'good' : top10 < 40 ? 'warn' : 'bad';
  const ratsTone: Tone = rats === null ? 'neutral' : rats < 5 ? 'good' : rats < 15 ? 'warn' : 'bad';
  const devTone: Tone = dev === 'cleared' ? 'warn' : dev === 'holding' ? 'good' : dev === 'active' ? 'bad' : 'neutral';
  const bundleTone: Tone = bundle === null ? 'neutral' : bundle < 5 ? 'good' : bundle < 15 ? 'warn' : 'bad';
  const sniperTone: Tone = sniper === null ? 'neutral' : sniper < 5 ? 'good' : sniper >= 10 ? 'bad' : 'warn';
  const lpTone: Tone = lp === null ? 'neutral' : lp >= 99 ? 'good' : lp >= 80 ? 'warn' : 'bad';

  return (
    <div className="space-y-2">
      <StaleBar stale={data?.stale} dataAgeSec={data?.data_age_sec} />
      <div className="grid grid-cols-2 gap-2">
      <Cell label={t('top10')} value={fmtPct(top10)} Icon={Users} tone={top10Tone} />
      <Cell label={t('rats')} value={fmtPct(rats)} Icon={Bug} tone={ratsTone} />
      <Cell label={t('dev')} value={dev ? t(`devStatus.${dev}`) : '--'} Icon={UserCog} tone={devTone} />
      <Cell label={t('bundle')} value={fmtPct(bundle)} Icon={Package} tone={bundleTone} />
      <Cell label={t('sniper')} value={fmtPct(sniper)} Icon={Crosshair} tone={sniperTone} />
      <Cell label={t('lpBurn')} value={fmtPct(lp)} Icon={Flame} tone={lpTone} />
      </div>
    </div>
  );
}

function Cell({
  label, value, Icon, tone,
}: {
  label: string;
  value: string;
  Icon: LucideIcon;
  tone: Tone;
}) {
  const toneCls =
    tone === 'good' ? 'text-success' :
    tone === 'warn' ? 'text-amber-500' :
    tone === 'bad' ? 'text-danger' :
    'text-muted-foreground/50';
  // P2-MOBILE-OVERHAUL #3 · 6 格统一 min-h + 文本不溢出 · 320/375/414 完全对齐
  return (
    <div
      className="rounded border border-border/40 bg-card/40 px-2.5 py-2 min-h-[64px] flex flex-col justify-between"
      data-testid="audit-cell"
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70 leading-tight">
        <span className="truncate">{label}</span>
      </div>
      <div className={`flex items-center gap-1 mt-0.5 text-[14px] font-mono font-semibold tabular-nums ${toneCls}`}>
        <span className="truncate">{value}</span>
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      </div>
    </div>
  );
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '--';
  return `${n.toFixed(2)}%`;
}
