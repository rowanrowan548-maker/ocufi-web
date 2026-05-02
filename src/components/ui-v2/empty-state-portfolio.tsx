/**
 * T-UI-OVERHAUL · 持仓页空状态(新用户视角)
 *
 * mockup ref: `.pf-empty` · ○ 圆形 icon + Newsreader italic accent 标题 + sub + 大金属按钮 + 3 个 pill
 *
 * 触发条件:连了钱包 · 但 GET /portfolio/savings 返 trade_count == 0
 */
import type { ReactNode } from 'react';
import { ItalicAccent } from './italic-accent';
import { MetalButton } from './metal-button';

interface EmptyStatePortfolioProps {
  /** "你还没在 Ocufi 交易过" · accent 词单独通过 prop 传 · 默认外面包好 */
  title: ReactNode;
  /** 副标 · "第一笔交易开始 · 我们就替你算每一分钱省在哪里 · 实时更新省钱总账" */
  sub: ReactNode;
  /** CTA · "立即开始 · 第一笔就便宜 90%" */
  ctaText: ReactNode;
  onCta?: () => void;
  /** 3 个 pill · "[手续费 0.1%] [MEV 保护] [ATA 回收]" */
  pills?: { text: ReactNode; accent?: ReactNode }[];
  /** icon · 默认 ○(用 Newsreader italic 渲染)· 也可传自定义 ReactNode */
  icon?: ReactNode;
}

export function EmptyStatePortfolio({
  title,
  sub,
  ctaText,
  onCta,
  pills,
  icon,
}: EmptyStatePortfolioProps) {
  return (
    <div
      className="relative z-[2]"
      style={{
        padding: '96px 0',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 32px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-v2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-newsreader), Georgia, serif',
          fontStyle: 'italic',
          fontSize: '36px',
          color: 'var(--brand-up)',
          boxShadow: '0 16px 48px -16px var(--brand-glow)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {icon ?? <ItalicAccent variant="green" as="span" style={{ fontSize: '36px', padding: 0 }}>○</ItalicAccent>}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-geist), -apple-system, sans-serif',
          fontWeight: 500,
          fontSize: '48px',
          letterSpacing: '-0.035em',
          lineHeight: 1.1,
          marginBottom: '20px',
          maxWidth: '18ch',
          marginLeft: 'auto',
          marginRight: 'auto',
          color: 'var(--ink-100)',
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: '16px',
          color: 'var(--ink-60)',
          marginBottom: '48px',
          maxWidth: '480px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {sub}
      </div>

      <MetalButton size="xl" onClick={onCta}>
        {ctaText}
      </MetalButton>

      {pills && pills.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginTop: '48px',
            flexWrap: 'wrap',
          }}
        >
          {pills.map((p, i) => (
            <div
              key={i}
              style={{
                padding: '10px 18px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-v2)',
                borderRadius: '100px',
                fontFamily: 'var(--font-geist-mono), Menlo, monospace',
                fontSize: '12px',
                color: 'var(--ink-60)',
                letterSpacing: '0.04em',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {p.accent && <span style={{ color: 'var(--brand-up)', marginRight: '6px' }}>{p.accent}</span>}
              {p.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
