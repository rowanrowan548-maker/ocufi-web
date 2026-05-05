/**
 * V2 OG Card · 透明度报告卡视觉锚 · home hero 装饰 + tx hero 双用
 *
 * variant:
 *   - 'home-hero'   · 460×320 · 桌面右侧装饰 · 微浮动 4s · 静态文案 SAVED 0.0045 SOL
 *   - 'home-mobile' · 全宽 · min-h 200 · 紧凑版 · 桌面 hidden 由父控
 *   - 'tx-hero'     · 760×420 · /tx 页主视觉锚 · 大字 brand→cyan 渐变 + glow · 微浮动 5s
 *
 * 公式(所有 variant 共用):
 *   - linear-gradient(135deg, deep, base) 背
 *   - border 1px brand-soft 0.18 · radius 20-24px
 *   - backdrop-filter blur 24 saturate 180%
 *   - shadow-glow-v2 (60px brand 0.12 + elev)
 *   - 内置 ::before 双 brand radial-gradient 光晕
 *   - 微浮动 keyframes(translateY 0 ↔ -6 / -8px)
 */
import Link from 'next/link';
import { LogoSvg } from './logo-svg';

type Variant = 'home-hero' | 'home-mobile' | 'tx-hero';

type OgCardProps = {
  variant: Variant;
  topLabel: string;        // "OCUFI · TX REPORT" / "TRANSPARENCY REPORT · #5fX..."
  topRight?: string;       // "OG · 1200×630" / "0.1% FEE"
  saveText: string;        // "SAVED 0.0045 SOL" / "省了 0.0045 SOL"
  subText?: string;        // "on $BONK · vs BullX" / 长 mid 副标
  footLeft?: string;       // "5fX...abc" / "ocufi.io/tx/<sig>"
  footRight?: string;      // "View report →" / "≈ $0.90 saved"
  /** 是否给 saveText 加 brand→cyan 渐变 + glow(tx-hero 用) */
  saveGradient?: boolean;
  /** 加 href 后整张卡包 Next/Link · cursor pointer · hover 强化 brand glow */
  href?: string;
};

const SIZES: Record<Variant, { padding: string; radius: number; lineSize: string; subSize: number; topSize: number; aspectRatio?: string; minHeight?: number; animation: string; maxWidth?: number; lineMaxWidth?: number; subMarginTop: number; }> = {
  'home-hero': {
    padding: '32px',
    radius: 20,
    lineSize: '36px',
    subSize: 13,
    topSize: 11,
    aspectRatio: '460 / 320',
    animation: 'v2-float-home 4s ease-in-out infinite',
    maxWidth: 460,
    lineMaxWidth: 380,
    subMarginTop: 12,
  },
  'home-mobile': {
    padding: '22px 22px',
    radius: 18,
    lineSize: '28px',
    subSize: 12,
    topSize: 10,
    minHeight: 200,
    animation: 'v2-float-home 4s ease-in-out infinite',
    subMarginTop: 8,
  },
  'tx-hero': {
    padding: '48px 44px',
    radius: 24,
    lineSize: 'clamp(44px, 5.5vw, 72px)',
    subSize: 16,
    topSize: 11,
    aspectRatio: '760 / 420',
    animation: 'v2-float 5s ease-in-out infinite',
    maxWidth: 760,
    lineMaxWidth: 640,
    subMarginTop: 18,
  },
};

export function OgCard({
  variant,
  topLabel,
  topRight,
  saveText,
  subText,
  footLeft,
  footRight,
  saveGradient = false,
  href,
}: OgCardProps) {
  const s = SIZES[variant];

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: s.maxWidth ?? '100%',
    ...(s.aspectRatio ? { aspectRatio: s.aspectRatio } : {}),
    ...(s.minHeight ? { minHeight: s.minHeight } : {}),
    background:
      'linear-gradient(135deg, rgba(14,17,23,0.95), rgba(11,13,18,0.85))',
    border: '1px solid var(--border-brand-soft)',
    borderRadius: s.radius,
    padding: s.padding,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: 'var(--shadow-glow-v2)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    animation: s.animation,
    color: 'var(--ink-100)',
    textDecoration: 'none',
    ...(href
      ? {
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
        }
      : {}),
  };

  const inner = (
    <>
      {/* 内置双 brand radial 光晕 · 跟 mockup 对齐 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 50% at 92% 8%, rgba(25,251,155,0.16), transparent 60%), radial-gradient(ellipse 40% 40% at 6% 95%, rgba(25,251,155,0.10), transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* top label · Logo + label · 右侧 optional 标签 */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: s.topSize,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--brand-up)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoSvg size={variant === 'tx-hero' ? 26 : 22} />
          <span>{topLabel}</span>
        </div>
        {topRight && <span>{topRight}</span>}
      </div>

      {/* mid · 大字 + 副标 */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: s.lineSize,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            color: 'var(--ink-100)',
            maxWidth: s.lineMaxWidth ?? '100%',
            ...(saveGradient
              ? {
                  background:
                    'linear-gradient(135deg, #19FB9B 0%, #03e1ff 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 60px rgba(25,251,155,0.32)',
                  fontFamily: 'var(--font-geist), sans-serif',
                  fontStyle: 'normal',
                  fontWeight: 500,
                }
              : {}),
          }}
        >
          {saveText}
        </div>
        {subText && (
          <div
            style={{
              marginTop: s.subMarginTop,
              fontFamily: variant === 'tx-hero' ? 'var(--font-geist), sans-serif' : 'var(--font-geist-mono), ui-monospace, monospace',
              fontSize: s.subSize,
              lineHeight: 1.55,
              color: 'var(--ink-80)',
              maxWidth: variant === 'tx-hero' ? 580 : '100%',
            }}
          >
            {subText}
          </div>
        )}
      </div>

      {/* foot · URL / view link */}
      {(footLeft || footRight) && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 11,
            color: 'var(--ink-40)',
          }}
        >
          {footLeft && <span>{footLeft}</span>}
          {footRight && (
            <span style={{ color: footRight.includes('→') ? 'var(--brand-up)' : 'var(--ink-40)' }}>
              {footRight}
            </span>
          )}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        className="v2-og-card-link"
        style={cardStyle}
      >
        {inner}
      </Link>
    );
  }

  return <div style={cardStyle}>{inner}</div>;
}
