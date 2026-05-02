/**
 * T-UI-OVERHAUL · 三大优势卡 · 64px Newsreader 编号 + 标题 + 描述 + bottom stat
 *
 * mockup ref: `.pillar` · 玻璃卡 hoverable · 编号 italic gradient(green→transparent)
 */
import type { ReactNode } from 'react';
import { GlassCard } from './glass-card';
import { ItalicAccent } from './italic-accent';

interface PillarCardProps {
  /** "01" "02" "03" */
  num: string;
  title: ReactNode;
  desc: ReactNode;
  /** 底部 stat 行 · "行业普遍 1.0% · 我们 1/10" */
  stat: ReactNode;
}

export function PillarCard({ num, title, desc, stat }: PillarCardProps) {
  return (
    <GlassCard hoverable radius={16}>
      <div style={{ padding: '40px 32px 36px' }}>
        <ItalicAccent
          variant="greenFade"
          as="span"
          style={{ fontSize: '64px', fontWeight: 300, lineHeight: 1, marginBottom: '24px', display: 'block', padding: 0 }}
        >
          {num}
        </ItalicAccent>
        <div
          style={{
            fontFamily: 'var(--font-geist), -apple-system, sans-serif',
            fontSize: '22px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--ink-100)',
            marginBottom: '16px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '14px',
            color: 'var(--ink-60)',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          {desc}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            fontSize: '12px',
            color: 'var(--brand-up)',
            letterSpacing: '0.04em',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-v2)',
          }}
        >
          {stat}
        </div>
      </div>
    </GlassCard>
  );
}
