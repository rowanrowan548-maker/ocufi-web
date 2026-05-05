/**
 * V2 Home Pillars · 3 pillar cards(0.1% / 非托管 / 透明)
 * 桌面 3 列 · mobile 1 列堆叠
 */
import { getTranslations } from 'next-intl/server';

export async function HomePillars() {
  const t = await getTranslations('v2.home');

  const pillars: { num: string; h: string; p: string }[] = [
    { num: t('pillars.0.num'), h: t('pillars.0.h'), p: t('pillars.0.p') },
    { num: t('pillars.1.num'), h: t('pillars.1.h'), p: t('pillars.1.p') },
    { num: t('pillars.2.num'), h: t('pillars.2.h'), p: t('pillars.2.p') },
  ];

  return (
    <div
      className="v2-home-pillars"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        maxWidth: 1320,
        margin: '0 auto',
        padding: '60px 56px 120px',
        borderTop: '1px solid var(--border-v2)',
      }}
    >
      {pillars.map((p, i) => (
        <div
          key={i}
          style={{
            padding: '32px 28px',
            background: 'var(--bg-card-v2)',
            border: '1px solid var(--border-v2)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-card-v2)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 32,
              color: 'var(--brand-up)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              marginBottom: 16,
            }}
          >
            {p.num}
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, letterSpacing: '-0.01em' }}>
            {p.h}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.55 }}>{p.p}</div>
        </div>
      ))}
    </div>
  );
}
