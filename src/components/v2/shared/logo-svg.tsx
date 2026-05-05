/**
 * V2 Logo · inline SVG · 严禁动 4 段弧 + 中心瞳点
 * 真 SVG 同 src/app/icon.svg
 *
 * 用法:<LogoSvg size={36} /> · 默认 32px
 */
type LogoSvgProps = { size?: number; className?: string };

export function LogoSvg({ size = 32, className }: LogoSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx="6" fill="#0A0B0D" />
      <path
        d="M 16 5 A 11 11 0 0 1 27 16"
        stroke="#19FB9B"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 16 27 A 11 11 0 0 1 5 16"
        stroke="#19FB9B"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 27 16 A 11 11 0 0 1 16 27"
        stroke="#19FB9B"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M 5 16 A 11 11 0 0 1 16 5"
        stroke="#19FB9B"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle cx="16" cy="16" r="2.2" fill="#19FB9B" />
    </svg>
  );
}
