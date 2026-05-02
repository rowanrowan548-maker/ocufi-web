/**
 * T-UI-OVERHAUL · Newsreader 斜体衬线 + 渐变文字
 *
 * mockup ref: `.hero-headline .accent` · `.demo-title .accent` · `.pf-empty-title .accent`
 *
 * 用法:hero 关键词 / 数字 / "省了" 那种 accent · 让一段普通文案中突出一两个词
 *
 * 三种渐变:
 *  - 'whiteToGreen'(默认 · hero 头部用)· 白 → 青绿
 *  - 'green'(纯青绿 · 不渐变 · accent 词用)
 *  - 'greenFade'(青绿向下 fade · pillar number 用)
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'whiteToGreen' | 'green' | 'greenFade';

interface ItalicAccentProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
  /** as: HTML tag · 默认 span */
  as?: 'span' | 'div';
}

const GRADIENTS: Record<Variant, string | undefined> = {
  whiteToGreen: 'linear-gradient(180deg, #FFFFFF 0%, var(--brand-up) 80%)',
  green: undefined,
  greenFade: 'linear-gradient(180deg, var(--brand-up) 0%, transparent 90%)',
};

export function ItalicAccent({
  children,
  variant = 'whiteToGreen',
  as: Tag = 'span',
  className,
  style,
}: ItalicAccentProps) {
  const gradient = GRADIENTS[variant];
  const baseStyle: CSSProperties = {
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontWeight: 400,
    letterSpacing: '-0.02em',
    padding: '0 0.05em',
    ...(gradient
      ? {
          background: gradient,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }
      : { color: 'var(--brand-up)' }),
    ...style,
  };

  return (
    <Tag className={cn(className)} style={baseStyle}>
      {children}
    </Tag>
  );
}
