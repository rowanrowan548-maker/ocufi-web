/**
 * T-UI-OVERHAUL · 拆解行(3 行 grid)· 左侧绿色短竖条
 *
 * mockup ref: `.bd-row` · 200/1fr/200 grid · label::before 4×28 brand bar + glow ·
 *             value 右对齐 brand 色 mono 18px
 *
 * 用法:wrap 多个 BreakdownRow 在 GlassCard 里(不设 padding · row 自己有)
 */
import type { ReactNode } from 'react';

interface BreakdownRowProps {
  /** 主 label · "手续费节省" */
  label: ReactNode;
  /** 中间 hint · "你 0.1% vs 行业 1.0%" */
  hint?: ReactNode;
  /** 右侧 value · "1.247 SOL" */
  value: ReactNode;
  /** 是否最后一行(去除 border-bottom) */
  last?: boolean;
}

export function BreakdownRow({ label, hint, value, last = false }: BreakdownRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr 200px',
        gap: '32px',
        padding: '22px 32px',
        alignItems: 'center',
        borderBottom: last ? 'none' : '1px solid var(--border-v2)',
      }}
    >
      <div
        style={{
          fontSize: '14px',
          color: 'var(--ink-100)',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          letterSpacing: '-0.01em',
        }}
      >
        <span
          aria-hidden
          style={{
            width: '4px',
            height: '28px',
            background: 'var(--brand-up)',
            borderRadius: '2px',
            boxShadow: '0 0 8px var(--brand-glow)',
            flexShrink: 0,
          }}
        />
        {label}
      </div>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--ink-60)',
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
        }}
      >
        {hint}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '18px',
          fontWeight: 500,
          color: 'var(--brand-up)',
          textAlign: 'right',
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {value}
      </div>
    </div>
  );
}
