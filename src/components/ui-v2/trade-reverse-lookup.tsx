/**
 * T-UI-OVERHAUL · 持仓行展开 · 单笔交易反查 3 列对比
 *
 * mockup ref: `.pf-expanded` · context line + 3 col compare(us/them/saved)+ actions
 *
 * 结构:
 *  - context:你在 04/27 买入 18.4M BONK 花了 0.450 SOL
 *  - 3 col:
 *      OCUFI 实付 0.45045 SOL · "含 0.1% 手续费"
 *      别家会收 0.45562 SOL · "1.0% 费 + 0.15% MEV 损失"
 *      你省了 0.00517 SOL · italic Newsreader · "≈ $0.43 / 这一笔"
 *  - actions:链上记录 / 复制 tx / 导出 CSV
 */
import type { ReactNode } from 'react';

export interface ReverseLookupColumn {
  label: ReactNode;
  /** 主数字 · 例 "0.45045 SOL" */
  value: ReactNode;
  /** 小注 · 例 "含 0.1% 手续费" */
  ratio?: ReactNode;
}

export interface ReverseLookupAction {
  /** 显示文本 */
  label: ReactNode;
  /** href · 优先(外链 / 内链)· 没有就用 onClick */
  href?: string;
  onClick?: () => void;
  /** 新窗口 · 默认 true(链上 explorer 一般新开) */
  external?: boolean;
}

interface TradeReverseLookupProps {
  /** "你在 04/27 买入 18.4M BONK 花了 0.450 SOL" 整段 ReactNode */
  context: ReactNode;
  /** OCUFI 实付列 */
  us: ReverseLookupColumn;
  /** 别家会收列 */
  them: ReverseLookupColumn;
  /** 你省了列 · italic 大字 */
  saved: ReverseLookupColumn;
  /** 底部 action 链(链上记录 / 复制 tx hash / 导出 CSV)· 可选 */
  actions?: ReverseLookupAction[];
}

export function TradeReverseLookup({
  context,
  us,
  them,
  saved,
  actions,
}: TradeReverseLookupProps) {
  return (
    <div
      className="relative z-[2]"
      style={{
        background: 'linear-gradient(180deg, var(--bg-elev) 0%, var(--bg-card) 100%)',
        padding: '32px',
        borderBottom: '1px solid var(--border-v2)',
        borderTop: '1px solid var(--border-brand)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '13px',
          color: 'var(--ink-60)',
          marginBottom: '28px',
        }}
      >
        {context}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '32px',
          padding: '28px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-v2)',
          borderRadius: '12px',
          marginBottom: actions && actions.length > 0 ? '24px' : 0,
        }}
      >
        <Column data={us} variant="us" />
        <Column data={them} variant="them" />
        <Column data={saved} variant="saved" />
      </div>

      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {actions.map((a, i) =>
            a.href ? (
              <a
                key={i}
                href={a.href}
                target={a.external !== false ? '_blank' : undefined}
                rel={a.external !== false ? 'noopener noreferrer' : undefined}
                onClick={a.onClick}
                style={actionStyle}
              >
                {a.label}
              </a>
            ) : (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                style={{ ...actionStyle, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {a.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

const actionStyle = {
  fontSize: '13px',
  color: 'var(--brand-up)',
  textDecoration: 'none',
  fontFamily: 'var(--font-geist-mono), Menlo, monospace',
  borderBottom: '1px dashed var(--border-brand)',
  paddingBottom: '2px',
  transition: 'all 200ms',
} as const;

function Column({
  data,
  variant,
}: {
  data: ReverseLookupColumn;
  variant: 'us' | 'them' | 'saved';
}) {
  const valStyle =
    variant === 'saved'
      ? {
          color: 'var(--brand-up)',
          fontFamily: 'var(--font-newsreader), Georgia, serif',
          fontStyle: 'italic' as const,
          fontSize: '32px',
          fontWeight: 400,
        }
      : {
          color: variant === 'us' ? 'var(--brand-up)' : 'var(--ink-80)',
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '22px',
          fontWeight: 500,
        };

  return (
    <div>
      <label
        style={{
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '11px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-60)',
          display: 'block',
          marginBottom: '12px',
        }}
      >
        {data.label}
      </label>
      <span
        style={{
          ...valStyle,
          fontFeatureSettings: "'tnum' 1",
          display: 'block',
          marginBottom: '6px',
        }}
      >
        {data.value}
      </span>
      {data.ratio && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--ink-40)',
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          }}
        >
          {data.ratio}
        </span>
      )}
    </div>
  );
}
