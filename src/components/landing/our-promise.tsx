'use client';

/**
 * Landing · Ocufi 自己的承诺(替换原"竞品对比表")
 *
 * 设计原则:
 *  - 不点名任何竞品,不展示外部数字 — 避免被指控不实信息
 *  - 6 张承诺卡片 + 1 个计算器(只算 Ocufi 自家费用)
 *  - 计算器文案中性,不引用外部费率,只解释 Ocufi 自己的费率结构
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Calculator,
  Coins,
  PiggyBank,
  Lock,
  Eye,
  ShieldCheck,
  Languages,
} from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PromiseItem {
  Icon: typeof Coins;
  key: string;
  value?: string;        // 直接展示的常量值(如 "0.1%")
  valueKey?: string;     // 走 i18n 的值(如 V1 卖出免费的"免费/Free")
}

const PROMISES: PromiseItem[] = [
  { Icon: Coins,       key: 'buyFee',       value: '0.1%' },
  { Icon: PiggyBank,   key: 'sellFee',      valueKey: 'sellFeeValue' },
  { Icon: Lock,        key: 'nonCustodial' },
  { Icon: Eye,         key: 'openSource' },
  { Icon: ShieldCheck, key: 'dualSafety' },
  { Icon: Languages,   key: 'i18n' },
];

const OCUFI_BLENDED_RATE = 0.0005; // 0.1% 买 + 0 卖,买卖各半均摊

export function OurPromise() {
  const t = useTranslations('landing.promise');
  const [monthlyUsd, setMonthlyUsd] = useState(10_000);

  const monthlyCost = monthlyUsd * OCUFI_BLENDED_RATE;
  const yearlyCost = monthlyCost * 12;

  return (
    <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>

        {/* ── 6 张承诺卡 ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10">
          {PROMISES.map(({ Icon, key, value, valueKey }) => (
            <Card
              key={key}
              className="p-4 sm:p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="font-mono font-bold text-lg sm:text-xl text-primary">
                  {value ?? (valueKey ? t(valueKey) : '✓')}
                </div>
              </div>
              <div className="text-sm font-medium leading-snug">
                {t(`items.${key}.title`)}
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                {t(`items.${key}.desc`)}
              </div>
            </Card>
          ))}
        </div>

        {/* ── 计算器 · 只算 Ocufi 自家费用 ── */}
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

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
              <div className="text-[10px] text-primary/80 font-mono">
                {t('calc.monthly')}
              </div>
              <div className="font-mono text-base font-semibold text-primary">
                ${monthlyCost.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
              <div className="text-[10px] text-primary/80 font-mono">
                {t('calc.yearly')}
              </div>
              <div className="font-mono text-base font-semibold text-primary">
                ${yearlyCost.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground/80 text-center pt-1 border-t border-border/40">
            {t('calc.note')}
          </div>
        </Card>
      </div>
    </section>
  );
}
