/**
 * T-UI-OVERHAUL · 通用玻璃质感卡 · luxury dark glass
 *
 * mockup ref: `.demo-card` / `.pillar` / `.social-card` / `.pf-table` / `.breakdown` 同模式
 * 关键:bg-card + 1px border + backdrop-blur 20px saturate 180% + shadow-card
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  /** 强调边(border-brand + glow)· 用于 us 视角对比 / savings 卡 / 关键 callout */
  highlight?: boolean;
  /** hover 浮起效果 · 默认 false(列表行类不要 hover transform) */
  hoverable?: boolean;
  /** 圆角档位 · 默认 16px · 可改 12 / 20 */
  radius?: 12 | 16 | 20;
  className?: string;
  style?: CSSProperties;
}

export function GlassCard({
  children,
  highlight = false,
  hoverable = false,
  radius = 16,
  className,
  style,
}: GlassCardProps) {
  const baseStyle: CSSProperties = {
    background: 'var(--bg-card)',
    border: highlight
      ? '1px solid var(--border-brand)'
      : '1px solid var(--border-v2)',
    borderRadius: `${radius}px`,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    boxShadow: highlight
      ? 'var(--shadow-card), 0 0 0 1px var(--border-brand), 0 24px 48px -16px var(--brand-glow)'
      : 'var(--shadow-card)',
    transition: hoverable ? 'background 300ms, border-color 300ms, transform 300ms' : undefined,
    ...style,
  };

  return (
    <div
      className={cn('relative z-[2]', hoverable && 'glass-card-hoverable', className)}
      style={baseStyle}
    >
      {children}
    </div>
  );
}
