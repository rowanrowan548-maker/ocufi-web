'use client';

/**
 * V2 Token Chip · token icon + symbol + 价格 三列
 * 38px 高 · hover 微浮起 + brand border
 *
 * icon 用渐变色 fallback(无真 logo URL)
 */
import Link from 'next/link';
import { useState } from 'react';

type ChipTokenProps = {
  symbol: string;
  price?: string;
  href?: string;
  /** 渐变 icon 颜色对(2 色) · 不给则用默认 ink */
  iconGradient?: [string, string];
  iconText?: string;
  iconImg?: string;
};

const FALLBACK_GRADIENTS: Record<string, [string, string]> = {
  BONK: ['#f97316', '#fb923c'],
  WIF: ['#ec4899', '#f9a8d4'],
  POPCAT: ['#fef08a', '#fbbf24'],
  JUP: ['#19FB9B', '#03e1ff'],
  PYTH: ['#a855f7', '#c084fc'],
  SOL: ['#00ffa3', '#03e1ff'],
};

export function ChipToken({
  symbol,
  price,
  href,
  iconGradient,
  iconText,
  iconImg,
}: ChipTokenProps) {
  const [hover, setHover] = useState(false);
  const grad = iconGradient ?? FALLBACK_GRADIENTS[symbol.toUpperCase()] ?? ['#5A5A57', '#8A8A87'];
  const iconChar = iconText ?? symbol.charAt(0).toUpperCase();

  const inner = (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px 8px 8px',
        borderRadius: 999,
        background: hover ? 'var(--bg-card-hover)' : 'var(--bg-card-v2)',
        border: `1px solid ${hover ? 'var(--border-brand-soft)' : 'var(--border-v2)'}`,
        color: 'var(--ink-100)',
        fontSize: 13,
        cursor: 'pointer',
        transition: 'all 0.15s',
        height: 38,
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          background: iconImg
            ? `url(${iconImg}) center/cover no-repeat`
            : `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`,
        }}
      >
        {!iconImg && iconChar}
      </span>
      <span style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>{symbol}</span>
      {price && (
        <span
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            color: 'var(--ink-60)',
            fontSize: 12,
          }}
        >
          {price}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false} style={{ textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
