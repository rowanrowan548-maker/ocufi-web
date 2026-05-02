/**
 * T-UI-OVERHAUL · 持仓清单行 · 玻璃 table row · 可点展开
 *
 * mockup ref: `.pf-row` · 6 col grid: icon / token+sub / amount / value / change / arrow
 *
 * row hover bg-card-hover · 点击 onClick 给 parent 控制展开 · 展开内容 parent 自己写
 *
 * 渲染策略:简单 row 模式(数据 prop)· 复杂展开内容用 parent 渲染 + key 触发
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChangeDirection = 'up' | 'down' | 'flat';

interface HoldingRowProps {
  /** Token 大字 · "BONK" */
  symbol: ReactNode;
  /** 副 · 全名 · "Bonk Token" */
  name?: ReactNode;
  /** Token icon · 自定义 React node(<img> / 字母兜底)· 会被装进 36×36 圆 */
  icon?: ReactNode;
  /** 渐变 fallback color(没 icon 用)· 默认 ink-40 → ink-20 */
  iconGradient?: string;
  /** Amount · "1,247,000" */
  amount: ReactNode;
  /** USD Value · "$48.92" */
  value: ReactNode;
  /** 24h change · "+12.4%" */
  change: ReactNode;
  changeDir: ChangeDirection;
  /** 是否高亮(展开时) */
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

const CHANGE_COLOR: Record<ChangeDirection, string> = {
  up: 'var(--brand-up)',
  down: 'var(--brand-down)',
  flat: 'var(--ink-60)',
};

export function HoldingRow({
  symbol,
  name,
  icon,
  iconGradient,
  amount,
  value,
  change,
  changeDir,
  active = false,
  onClick,
  className,
}: HoldingRowProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={cn('holding-row-v2', className)}
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 1fr 1fr 1fr 60px',
        gap: '20px',
        padding: '22px 28px',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-v2)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 200ms',
        background: active ? 'var(--bg-card-hover)' : undefined,
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: iconGradient ?? 'linear-gradient(135deg, var(--ink-40), var(--ink-20))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-geist), -apple-system, sans-serif',
          fontWeight: 600,
          fontSize: '13px',
          color: 'var(--ink-80)',
          overflow: 'hidden',
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-geist), -apple-system, sans-serif',
          fontSize: '16px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--ink-100)',
        }}
      >
        {symbol}
        {name && (
          <div
            style={{
              fontSize: '11px',
              fontWeight: 400,
              color: 'var(--ink-60)',
              marginTop: '2px',
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            }}
          >
            {name}
          </div>
        )}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '14px',
          color: 'var(--ink-60)',
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {amount}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--ink-100)',
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          fontSize: '14px',
          fontFeatureSettings: "'tnum' 1",
          color: CHANGE_COLOR[changeDir],
        }}
      >
        {change}
      </div>

      <div
        style={{
          textAlign: 'right',
          color: 'var(--ink-40)',
          fontSize: '18px',
          fontFamily: 'var(--font-newsreader), Georgia, serif',
        }}
      >
        {active ? '↓' : '→'}
      </div>
    </div>
  );
}
