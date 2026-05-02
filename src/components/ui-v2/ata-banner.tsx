/**
 * T-UI-OVERHAUL · ATA 押金横幅 · 青绿渐变 bg + 内层 dashed border + 黑底按钮
 *
 * mockup ref: `.ata-banner` · 135deg brand gradient · 黑色文字 · 右上 dashed border
 *             24px brand-glow shadow · 黑底 brand 色 button
 */
import type { ReactNode } from 'react';

interface AtaBannerProps {
  /** 主文 · "32 个空 ATA · 可一键回收 0.064 SOL" */
  text: ReactNode;
  /** 副 meta · "市价折合 ≈ $5.36 · 你的钱本来就该退给你" */
  meta?: ReactNode;
  /** 按钮文 · "一键全收" */
  buttonText: ReactNode;
  /** 按钮点 */
  onAction?: () => void;
  /** 禁用 */
  disabled?: boolean;
}

export function AtaBanner({ text, meta, buttonText, onAction, disabled }: AtaBannerProps) {
  return (
    <div
      className="relative z-[2]"
      style={{
        background: 'linear-gradient(135deg, var(--brand-up) 0%, #14E089 100%)',
        color: '#051B10',
        padding: '28px 36px',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        boxShadow: '0 24px 48px -16px var(--brand-glow)',
        gap: '24px',
      }}
    >
      {/* 内层 dashed border */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          bottom: '16px',
          border: '1px dashed rgba(5, 27, 16, 0.2)',
          borderRadius: '10px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.01em' }}>{text}</div>
        {meta && (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              opacity: 0.65,
              marginTop: '6px',
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            }}
          >
            {meta}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="ata-banner-btn"
        style={{
          background: '#051B10',
          color: 'var(--brand-up)',
          border: 'none',
          padding: '14px 28px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          fontFamily: 'inherit',
          borderRadius: '8px',
          letterSpacing: '-0.01em',
          position: 'relative',
          boxShadow: '0 1px 0 0 rgba(255,255,255,0.05) inset',
          transition: 'all 200ms',
          flexShrink: 0,
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}
