/**
 * T-UI-OVERHAUL · 装饰小标签 · uppercase + 左侧青绿小圆点 + glow
 *
 * mockup ref: `.eyebrow` · pillar form · uppercase · Geist Mono · letter-spacing 0.16em
 *
 * 用法:hero 上方 / 模块标题前点缀 · "Solana · 非托管 · 开源" 那种
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EyebrowPillProps {
  children: ReactNode;
  /** 不显左侧绿点(模块标题前用 · 按需) */
  noDot?: boolean;
  /** 文字 / 边 / 点都换青绿(已选中态)· 默认灰 */
  brand?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function EyebrowPill({
  children,
  noDot = false,
  brand = false,
  className,
  style,
}: EyebrowPillProps) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    fontFamily: 'var(--font-geist-mono), Menlo, monospace',
    fontSize: '11px',
    color: brand ? 'var(--brand-up)' : 'var(--ink-60)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontWeight: 500,
    padding: '6px 14px 6px 10px',
    border: '1px solid var(--border-v2)',
    background: 'var(--bg-card)',
    borderRadius: '100px',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    ...style,
  };

  return (
    <span className={cn('relative z-[2]', className)} style={baseStyle}>
      {!noDot && (
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
      )}
      {children}
    </span>
  );
}
