/**
 * V2 Eyebrow Pill · brand 圆点 + Mono uppercase 标签
 * 用法:<EyebrowPill>SOLANA · NON-CUSTODIAL · 0.1% FEE</EyebrowPill>
 */
type EyebrowPillProps = { children: React.ReactNode };

export function EyebrowPill({ children }: EyebrowPillProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
        fontSize: 12,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--brand-up)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--brand-up)',
          boxShadow: '0 0 12px var(--brand-glow-strong)',
          flexShrink: 0,
        }}
      />
      <span>{children}</span>
    </div>
  );
}
