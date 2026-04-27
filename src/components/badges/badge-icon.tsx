'use client';

/**
 * T-906b · BadgeIcon · ocufi Arc O 风格徽章框 + 中心 Lucide 图标
 *
 * 视觉:
 *   - 圆形 SVG · 4 段弧虚实组合(沿用 logo 视觉语言)
 *   - 主色绿 oklch(0.88 0.25 155) · rarity 决定描边透明度
 *     · common 0.3 / uncommon 0.6 / legendary 1.0
 *   - legendary + earned: drop-shadow 12px 主色绿光晕
 *   - 中心嵌 Lucide 图标(动态查表 fallback HelpCircle)
 *   - !earned: grayscale + opacity-40
 */
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

export type BadgeRarity = 'common' | 'uncommon' | 'legendary';

interface Props {
  /** Lucide icon name(Sunrise / Sparkles / Flame / UserPlus / Crown / ...) */
  icon: string;
  rarity: BadgeRarity;
  earned: boolean;
  size?: number;
  className?: string;
}

const RARITY_ALPHA: Record<BadgeRarity, number> = {
  common: 0.3,
  uncommon: 0.6,
  legendary: 1.0,
};

type LucideComponent = React.FC<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;

export function BadgeIcon({ icon, rarity, earned, size = 80, className }: Props) {
  const IconLib = Icons as unknown as Record<string, LucideComponent>;
  const IconComp = IconLib[icon] ?? IconLib.HelpCircle;
  const alpha = RARITY_ALPHA[rarity];
  const stroke = `oklch(0.88 0.25 155 / ${alpha})`;
  const center = `oklch(0.88 0.25 155 / ${Math.min(1, alpha + 0.2)})`;
  const glow =
    rarity === 'legendary' && earned
      ? 'drop-shadow(0 0 12px oklch(0.88 0.25 155 / 0.45))'
      : 'none';
  const inner = Math.round(size * 0.4);

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center',
        !earned && 'grayscale opacity-40',
        className
      )}
      style={{ width: size, height: size, filter: glow }}
      aria-label={icon}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="absolute inset-0"
        aria-hidden
      >
        {/* 外层主弧:46 段实 + 23 段虚交错(Arc O 视觉) */}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="46 23"
          transform="rotate(-90 50 50)"
        />
        {/* 内圈点状辅助线 */}
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke={stroke}
          strokeWidth="1"
          strokeDasharray="2 5"
          opacity="0.55"
          transform="rotate(-90 50 50)"
        />
        {/* legendary 加额外内层亮环 */}
        {rarity === 'legendary' && (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={stroke}
            strokeWidth="0.6"
            opacity="0.6"
          />
        )}
      </svg>
      <IconComp
        size={inner}
        strokeWidth={1.8}
        style={{ color: center, position: 'relative', zIndex: 1 }}
      />
    </div>
  );
}
