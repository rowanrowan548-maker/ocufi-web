/**
 * T-UI-OVERHAUL · 玻璃 ghost 按钮 · 次级 CTA
 *
 * mockup ref: `.btn-ghost` · bg-card + border + backdrop-blur 8px
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

interface GhostButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  size?: Size;
}

const SIZE_MAP: Record<Size, { padY: number; padX: number; fontSize: number; radius: number }> = {
  sm: { padY: 9, padX: 18, fontSize: 13, radius: 6 },
  md: { padY: 11, padX: 22, fontSize: 14, radius: 7 },
  lg: { padY: 16, padX: 28, fontSize: 15, radius: 8 },
};

export function GhostButton({
  children,
  size = 'md',
  className,
  style,
  disabled,
  ...rest
}: GhostButtonProps) {
  const s = SIZE_MAP[size];
  const baseStyle: CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-v2)',
    color: 'var(--ink-100)',
    padding: `${s.padY}px ${s.padX}px`,
    fontWeight: 500,
    fontSize: `${s.fontSize}px`,
    fontFamily: 'inherit',
    borderRadius: `${s.radius}px`,
    letterSpacing: '-0.01em',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 200ms',
    ...style,
  };

  return (
    <button
      type={rest.type ?? 'button'}
      disabled={disabled}
      className={cn('ghost-button-v2 relative z-[2] inline-flex items-center justify-center', className)}
      style={baseStyle}
      {...rest}
    >
      {children}
    </button>
  );
}
