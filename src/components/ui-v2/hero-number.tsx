/**
 * T-UI-OVERHAUL · 大数字 + tabular numerals + 可选滚动动画 + 单位
 *
 * mockup ref: `.demo-savings .value` 88px / `.pf-savings-value` 88px / `.pf-empty-icon` 36px /
 *             `.rw-hero` 152px / `.social-stat .num` 56px
 *
 * 默认 Newsreader italic + brand 色 + 1.0 line-height + 'tnum' tabular
 * 可选:`animate=true` 进场滚动到 value(requestAnimationFrame · 1.2s ease-out · 仅一次)
 */
'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface HeroNumberProps {
  /** 目标数字 · 整数或小数 */
  value: number;
  /** 字号 px · clamp 的话外面包一层 */
  size?: number;
  /** 单位(SOL · USD · 等)· 在数字后面 0.4em 灰色 */
  unit?: string;
  /** 强制颜色 · 默认 var(--brand-up) */
  color?: string;
  /** 进场滚动动画 · 仅一次 · 默认开 */
  animate?: boolean;
  /** 小数位数 · 默认按 value 自动 */
  decimals?: number;
  className?: string;
  style?: CSSProperties;
}

function formatNumber(n: number, decimals?: number): string {
  if (decimals != null) return n.toFixed(decimals);
  // 小数 · 保留 3 位 · 不带尾 0
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function HeroNumber({
  value,
  size = 88,
  unit,
  color = 'var(--brand-up)',
  animate = true,
  decimals,
  className,
  style,
}: HeroNumberProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : value);
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!animate) {
      setDisplayed(value);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (startedRef.current) {
      // value 变了 · 重新从当前显示值滚到新值
      setDisplayed(value);
      return;
    }
    // viewport 触发 · 仅一次
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const start = performance.now();
          const duration = 1200;
          const from = 0;
          const to = value;
          const tick = (t: number) => {
            const p = Math.min(1, (t - start) / duration);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplayed(from + (to - from) * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          obs.disconnect();
        }
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [animate, value]);

  const baseStyle: CSSProperties = {
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontWeight: 400,
    fontSize: `${size}px`,
    letterSpacing: '-0.03em',
    lineHeight: 1,
    color,
    fontFeatureSettings: "'tnum' 1",
    display: 'inline-block',
    ...style,
  };

  const unitStyle: CSSProperties = {
    fontSize: '0.4em',
    fontStyle: 'normal',
    fontFamily: 'var(--font-geist), -apple-system, sans-serif',
    color: 'var(--ink-60)',
    fontWeight: 300,
    marginLeft: '0.2em',
  };

  return (
    <span ref={ref} className={cn('relative z-[2]', className)} style={baseStyle}>
      {formatNumber(displayed, decimals)}
      {unit && <span style={unitStyle}>{unit}</span>}
    </span>
  );
}
