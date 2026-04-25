/**
 * Ocufi Logo · Arc O
 *
 * 4 段弧虚实组合的字母 O,中心瞳点。
 *  - 上下两段实色弧 = 主结构
 *  - 左右两段淡色弧(opacity 0.3) = 节奏与呼吸
 *  - 中心点 = 用户,被环抱在 O 字内部
 *
 * 既是 Ocufi 的 O 字母,又延续"看清链上"的眼意,业内未撞设计
 *
 * 3 变体:
 *  - mark:    只图形(favicon / avatar)
 *  - full:    图形 + 字样
 *  - wordmark: 只字样
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
      {/* Arc O · 上右 + 下左 实色弧 */}
      <path d="M 16 5 A 11 11 0 0 1 27 16" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <path d="M 16 27 A 11 11 0 0 1 5 16" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      {/* 下右 + 上左 淡色弧 · 形成节奏 */}
      <path d="M 27 16 A 11 11 0 0 1 16 27" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M 5 16 A 11 11 0 0 1 16 5" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.3" />
      {/* 中心瞳点 */}
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
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
