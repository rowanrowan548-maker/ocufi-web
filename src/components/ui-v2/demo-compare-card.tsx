/**
 * T-UI-OVERHAUL · Demo 对比卡(them / us 两种)
 *
 * mockup ref: `.demo-card.them` / `.demo-card.us` · 标签 + 名字 + meta + 数据行 + total
 *
 * us 卡:linear-gradient soft brand bg + border-brand + glow + "OCUFI" 绿点
 * them 卡:微红 bg + 灰 border + 黑红总成本
 */
import type { ReactNode } from 'react';

export interface DemoCompareRow {
  label: ReactNode;
  value: ReactNode;
}

interface DemoCompareCardProps {
  variant: 'them' | 'us';
  /** "行业平均" / "OCUFI" */
  brandLabel: ReactNode;
  /** "其他交易终端" / "Ocufi · 0.1% Forever" */
  name: ReactNode;
  /** "普遍 1.0% 收费 + 无 MEV 保护" 等 */
  meta: ReactNode;
  /** 4-5 条 detail row */
  rows: DemoCompareRow[];
  /** "总成本" + 数值 · highlight bigger */
  totalLabel: ReactNode;
  totalValue: ReactNode;
}

export function DemoCompareCard({
  variant,
  brandLabel,
  name,
  meta,
  rows,
  totalLabel,
  totalValue,
}: DemoCompareCardProps) {
  const isUs = variant === 'us';
  const cardStyle = {
    background: isUs
      ? 'linear-gradient(180deg, rgba(25,251,155,0.05) 0%, transparent 100%), var(--bg-card)'
      : 'linear-gradient(180deg, rgba(255,107,107,0.04) 0%, transparent 100%), var(--bg-card)',
    border: isUs ? '1px solid var(--border-brand)' : '1px solid var(--border-v2)',
    borderRadius: '16px',
    padding: '36px 32px',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: isUs
      ? 'var(--shadow-card), 0 0 0 1px var(--border-brand), 0 24px 48px -16px var(--brand-glow)'
      : 'var(--shadow-card)',
  } as const;

  return (
    <div className="relative z-[2]" style={cardStyle}>
      <div
        style={{
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: isUs ? 'var(--brand-up)' : 'var(--ink-60)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {isUs && (
          <span
            aria-hidden
            style={{
              width: '6px',
              height: '6px',
              background: 'var(--brand-up)',
              borderRadius: '50%',
              boxShadow: '0 0 8px var(--brand-glow)',
            }}
          />
        )}
        {brandLabel}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: '22px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          marginBottom: '8px',
          color: isUs ? 'var(--ink-100)' : 'var(--ink-80)',
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: '13px',
          color: 'var(--ink-40)',
          marginBottom: '32px',
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
        }}
      >
        {meta}
      </div>

      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '16px 0',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border-v2)' : 'none',
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--ink-60)' }}>{r.label}</span>
          <span
            style={{
              fontSize: '14px',
              color: isUs ? 'var(--ink-100)' : 'var(--ink-80)',
              fontWeight: 500,
            }}
          >
            {r.value}
          </span>
        </div>
      ))}

      {/* Total · 大数字 */}
      <div
        style={{
          padding: '24px 0 8px',
          borderTop: '1px solid var(--border-strong)',
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            color: 'var(--ink-100)',
            fontWeight: 500,
            fontFamily: 'var(--font-geist), sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          {totalLabel}
        </span>
        <span
          style={{
            fontSize: '28px',
            fontWeight: 600,
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            letterSpacing: '-0.02em',
            color: isUs ? 'var(--brand-up)' : 'var(--brand-down)',
          }}
        >
          {totalValue}
        </span>
      </div>
    </div>
  );
}
