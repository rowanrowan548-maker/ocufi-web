/**
 * T-UI-OVERHAUL · 持仓页"你省了"玻璃卡 + brand glow
 *
 * mockup ref: `.pf-savings` · 135deg gradient + border-brand + 24px 64px brand-glow shadow
 *             + ::before mask 渐变描边
 */
import type { ReactNode } from 'react';
import { HeroNumber } from './hero-number';

interface SavingsCardProps {
  /** "Savings · 你省了" eyebrow */
  eyebrow?: ReactNode;
  /** 大数字(SOL) */
  valueSol: number;
  /** 单位字 · "SOL" */
  unit?: string;
  /** 副标 · "≈ $194.57 · 35 笔交易 · 平均每笔省 0.067 SOL" */
  sub?: ReactNode;
  /** 数字进场动画 · 默认 true */
  animate?: boolean;
}

export function SavingsCard({
  eyebrow = 'Savings · 你省了',
  valueSol,
  unit = 'SOL',
  sub,
  animate = true,
}: SavingsCardProps) {
  return (
    <div
      className="relative z-[2]"
      style={{
        background: 'linear-gradient(135deg, var(--brand-soft) 0%, transparent 50%), var(--bg-card)',
        border: '1px solid var(--border-brand)',
        borderRadius: '20px',
        padding: '36px 36px 32px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-card), 0 24px 64px -16px var(--brand-glow)',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '11px',
          letterSpacing: '0.18em',
          color: 'var(--brand-up)',
          textTransform: 'uppercase',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          aria-hidden
          style={{
            width: '6px',
            height: '6px',
            background: 'var(--brand-up)',
            borderRadius: '50%',
            boxShadow: '0 0 8px var(--brand-glow)',
            flexShrink: 0,
          }}
        />
        {eyebrow}
      </div>

      <div style={{ marginBottom: sub ? '12px' : 0 }}>
        <HeroNumber value={valueSol} size={88} unit={unit} animate={animate} decimals={3} />
      </div>

      {sub && (
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            fontSize: '13px',
            color: 'var(--ink-60)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
