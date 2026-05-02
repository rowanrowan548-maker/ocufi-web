/**
 * T-UI-OVERHAUL · 金属青绿主按钮 · luxury dark glass 主 CTA
 *
 * mockup ref: `.btn-primary` · linear-gradient + 内高光 + 外辉光 + hover translateY
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg' | 'xl';

interface MetalButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  /** 尺寸 · sm=11/22 · md=14/26 · lg=16/28 · xl=18/36(末尾 CTA) */
  size?: Size;
  /** 加宽字间距 · 用于"一  键  全  收" 那种 */
  spaced?: boolean;
}

const SIZE_MAP: Record<Size, { padY: number; padX: number; fontSize: number; radius: number }> = {
  sm: { padY: 9, padX: 18, fontSize: 13, radius: 6 },
  md: { padY: 11, padX: 22, fontSize: 14, radius: 7 },
  lg: { padY: 16, padX: 28, fontSize: 15, radius: 8 },
  xl: { padY: 18, padX: 36, fontSize: 16, radius: 10 },
};

export function MetalButton({
  children,
  size = 'md',
  spaced = false,
  className,
  style,
  disabled,
  ...rest
}: MetalButtonProps) {
  const s = SIZE_MAP[size];
  const baseStyle: CSSProperties = {
    background: 'linear-gradient(180deg, #2BFFA8 0%, #19FB9B 50%, #14E089 100%)',
    color: '#051B10',
    padding: `${s.padY}px ${s.padX}px`,
    fontWeight: 600,
    fontSize: `${s.fontSize}px`,
    border: 'none',
    fontFamily: 'inherit',
    borderRadius: `${s.radius}px`,
    letterSpacing: spaced ? '0.4em' : '-0.01em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.4) inset',
      '0 -1px 0 0 rgba(0,0,0,0.15) inset',
      '0 0 0 1px rgba(25,251,155,0.4)',
      '0 8px 24px -8px rgba(25, 251, 155, 0.45)',
      '0 2px 6px -2px rgba(25, 251, 155, 0.25)',
    ].join(','),
    transition: 'all 200ms',
    position: 'relative',
    ...style,
  };

  return (
    <button
      type={rest.type ?? 'button'}
      disabled={disabled}
      className={cn('metal-button-v2 relative z-[2] inline-flex items-center justify-center', className)}
      style={baseStyle}
      {...rest}
    >
      {children}
    </button>
  );
}
