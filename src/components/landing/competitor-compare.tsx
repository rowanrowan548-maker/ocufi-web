'use client';

/**
 * Landing · 竞品对比表 + 手续费计算器
 * 表格列固定:Ocufi / gmgn / bullx / photon(均为 Solana DEX 终端)
 * 计算器假设买卖各占 50%,Ocufi 卖出免费 → 均摊 0.05%
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X, Calculator, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Peer {
  name: string;
  buyBps: number;
  sellBps: number;
  custodial: boolean;
  openSource: boolean;
  dualSafety: boolean;
  zhUI: boolean;
  highlight?: boolean;
}

const PEERS: readonly Peer[] = [
  { name: 'Ocufi',  buyBps: 10,  sellBps: 0,   custodial: false, openSource: true,  dualSafety: true,  zhUI: true,  highlight: true },
  { name: 'gmgn',   buyBps: 100, sellBps: 100, custodial: false, openSource: false, dualSafety: false, zhUI: false },
  { name: 'bullx',  buyBps: 70,  sellBps: 70,  custodial: false, openSource: false, dualSafety: false, zhUI: false },
  { name: 'photon', buyBps: 100, sellBps: 100, custodial: false, openSource: false, dualSafety: false, zhUI: false },
] as const;

const OCUFI = PEERS[0];
const GMGN = PEERS[1];
// 均摊费率:买卖各 50% 假设
function avgBps(p: Peer): number {
  return (p.buyBps + p.sellBps) / 2;
}

export function CompetitorCompare() {
  const t = useTranslations('landing.compare');
  const [monthlyUsd, setMonthlyUsd] = useState(10_000);

  const ocufiCost = (monthlyUsd * avgBps(OCUFI)) / 10_000;
  const gmgnCost = (monthlyUsd * avgBps(GMGN)) / 10_000;
  const monthlySavings = gmgnCost - ocufiCost;
  const yearlySavings = monthlySavings * 12;

  return (
    <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>

        {/* ── 对比表 ── */}
        <Card className="overflow-x-auto p-0 mb-5 sm:mb-6">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left p-3 font-medium">{t('cols.metric')}</th>
                {PEERS.map((p) => (
                  <th
                    key={p.name}
                    className={`p-3 font-mono ${p.highlight ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {p.name}
                    {p.highlight && <span className="ml-1">★</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ValueRow
                label={t('rows.buyFee')}
                cells={PEERS.map((p) => `${(p.buyBps / 100).toFixed(1)}%`)}
                highlightIdx={0}
              />
              <ValueRow
                label={t('rows.sellFee')}
                cells={PEERS.map((p) => (p.sellBps === 0 ? t('values.free') : `${(p.sellBps / 100).toFixed(1)}%`))}
                highlightIdx={0}
              />
              <BoolRow label={t('rows.nonCustodial')} flags={PEERS.map((p) => !p.custodial)} />
              <BoolRow
                label={t('rows.openSource')}
                flags={PEERS.map((p) => p.openSource)}
                highlightIdx={0}
              />
              <BoolRow
                label={t('rows.dualSafety')}
                flags={PEERS.map((p) => p.dualSafety)}
                highlightIdx={0}
              />
              <BoolRow
                label={t('rows.zhUI')}
                flags={PEERS.map((p) => p.zhUI)}
                highlightIdx={0}
              />
            </tbody>
          </table>
        </Card>

        <div className="text-[11px] text-muted-foreground/70 mb-8 sm:mb-10 text-center">
          {t('disclaimer')}
        </div>

        {/* ── 手续费计算器 ── */}
        <Card className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <div className="font-medium text-sm">{t('calc.title')}</div>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <label htmlFor="ocufi-monthly-vol" className="text-xs text-muted-foreground">
                {t('calc.monthlyVolume')}
              </label>
              <span className="font-mono text-base font-semibold">
                ${monthlyUsd.toLocaleString()}
              </span>
            </div>
            <input
              id="ocufi-monthly-vol"
              type="range"
              min={100}
              max={100_000}
              step={100}
              value={monthlyUsd}
              onChange={(e) => setMonthlyUsd(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground/70">
              <span>$100</span>
              <span>$100,000</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
              <div className="text-[10px] text-primary/80 font-mono">
                Ocufi · {(avgBps(OCUFI) / 100).toFixed(2)}%
              </div>
              <div className="font-mono text-base font-semibold text-primary">
                ${ocufiCost.toFixed(0)}/{t('calc.monthShort')}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-1">
              <div className="text-[10px] text-muted-foreground font-mono">
                gmgn · {(avgBps(GMGN) / 100).toFixed(1)}%
              </div>
              <div className="font-mono text-base text-muted-foreground">
                ${gmgnCost.toFixed(0)}/{t('calc.monthShort')}
              </div>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1">
              <div className="text-[10px] text-success/80 font-mono flex items-center justify-center gap-1">
                <TrendingDown className="h-3 w-3" />
                {t('calc.savings')}
              </div>
              <div className="font-mono text-base font-semibold text-success">
                ${monthlySavings.toFixed(0)}/{t('calc.monthShort')}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground/80 text-center pt-1 border-t border-border/40">
            {t('calc.yearly', { amount: Math.round(yearlySavings).toLocaleString() })}
          </div>
        </Card>
      </div>
    </section>
  );
}

function ValueRow({
  label,
  cells,
  highlightIdx,
}: {
  label: string;
  cells: string[];
  highlightIdx?: number;
}) {
  return (
    <tr className="border-t border-border/40">
      <td className="p-3 text-muted-foreground">{label}</td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={`p-3 text-center font-mono ${i === highlightIdx ? 'font-semibold text-primary' : ''}`}
        >
          {c}
        </td>
      ))}
    </tr>
  );
}

function BoolRow({
  label,
  flags,
  highlightIdx,
}: {
  label: string;
  flags: boolean[];
  highlightIdx?: number;
}) {
  return (
    <tr className="border-t border-border/40">
      <td className="p-3 text-muted-foreground">{label}</td>
      {flags.map((ok, i) => (
        <td key={i} className="p-3 text-center">
          {ok ? (
            <Check
              className={`h-4 w-4 mx-auto ${
                i === highlightIdx ? 'text-primary' : 'text-success'
              }`}
            />
          ) : (
            <X className="h-4 w-4 mx-auto text-muted-foreground/40" />
          )}
        </td>
      ))}
    </tr>
  );
}
