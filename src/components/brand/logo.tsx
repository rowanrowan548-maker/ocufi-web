/**
 * Ocufi Logo
 *
 * 几何方块 + 字样,参考 Linear / Vercel / Raycast 风格。
 * 3 种变体:
 *   - mark:   只有图形(做 favicon / avatar / 商标)
 *   - full:   图形 + 字样(顶部 nav / Hero)
 *   - wordmark: 只有字样
 *
 * 图形解读:
 *   外方块 = 链上世界的边界 · 斜切 45° = 视线穿透(Oculus + Fi 的"看")
 *   内点 = 用户,始终被框柔和地包住
 */

interface LogoProps {
  variant?: 'mark' | 'full' | 'wordmark';
  className?: string;
  /** 固定尺寸,单位 px */
  size?: number;
}

export function Logo({ variant = 'full', className = '', size = 24 }: LogoProps) {
  const markSize = size;

  if (variant === 'wordmark') {
    return (
      <span
        className={`font-heading font-bold tracking-tight ${className}`}
        style={{ fontSize: size * 0.9, letterSpacing: '-0.03em' }}
      >
        Ocufi
      </span>
    );
  }

  const mark = (
    <svg
      width={markSize}
      height={markSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      aria-label="Ocufi"
    >
      {/* 外框菱形,45° 旋转的圆角方块 */}
      <rect
        x="4" y="4" width="24" height="24"
        rx="6"
        transform="rotate(45 16 16)"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      {/* 中心点 · 品牌色填充 */}
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );

  if (variant === 'mark') {
    return <span className={`text-primary ${className}`}>{mark}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-primary">{mark}</span>
      <span
        className="font-heading font-bold tracking-tight"
        style={{ fontSize: size * 0.85, letterSpacing: '-0.03em' }}
      >
        Ocufi
      </span>
    </span>
  );
}
