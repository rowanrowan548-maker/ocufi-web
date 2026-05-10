'use client';

/**
 * T-UI-OVERHAUL Stage 5.3a · 首页 luxury dark glass(冷启动 5 屏)
 *
 * 双状态:
 *  - 没连钱包:渲染 5 屏(Hero / Demo / Pillars / Social / Final CTA)
 *  - 连了钱包:router.replace('/portfolio')(老用户/新用户分流由 portfolio 页处理)
 *
 * mockup ref:.coordination/MOCKUPS/ui-overhaul-preview-v2.html PAGE 1
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import {
  EyebrowPill,
  ItalicAccent,
  MetalButton,
  GhostButton,
  PillarCard,
  DemoCompareCard,
  HeroNumber,
  type DemoCompareRow,
} from '@/components/ui-v2';
import type { PublicStats } from '@/lib/api-client';

interface Props {
  publicStats: PublicStats | null;
}

export function LandingV2View({ publicStats }: Props) {
  const t = useTranslations('landingV2');
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  // 已连钱包 → 直接转跳 portfolio · portfolio 页内根据 trade_count 分新/老用户
  useEffect(() => {
    if (connected && publicKey) {
      router.replace('/portfolio');
    }
  }, [connected, publicKey, router]);

  if (connected) {
    // 防止跳转过程中闪 5 屏(useEffect 还没执行前的第一帧)
    return null;
  }

  return (
    <main className="relative z-[2] flex flex-1 flex-col">
      <HeroSection
        t={t}
        onConnect={() => openWalletModal(true)}
      />
      <DemoSection t={t} />
      <PillarsSection t={t} />
      <SocialSection t={t} stats={publicStats} />
      <FinalCtaSection t={t} onConnect={() => openWalletModal(true)} />
    </main>
  );
}

// ─── Hero(第 1 屏) ──────────────────────────────

function HeroSection({
  t,
  onConnect,
}: {
  t: ReturnType<typeof useTranslations>;
  onConnect: () => void;
}) {
  return (
    <section
      className="relative"
      style={{ padding: '144px 0 96px', textAlign: 'center' }}
    >
      <div className="max-w-[1240px] mx-auto px-14 relative">
        <div className="mb-12 inline-flex">
          <EyebrowPill noDot>{t('eyebrow')}</EyebrowPill>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-geist), -apple-system, sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(56px, 7.2vw, 96px)',
            lineHeight: 0.98,
            letterSpacing: '-0.045em',
            color: 'var(--ink-100)',
            marginBottom: '32px',
            maxWidth: '14ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {t('hero.lineA')}
          <br />
          {t('hero.lineB')}
          <ItalicAccent variant="whiteToGreen">{t('hero.accent')}</ItalicAccent>
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: 'var(--ink-60)',
            maxWidth: '540px',
            margin: '0 auto 56px',
            lineHeight: 1.55,
            letterSpacing: '-0.005em',
          }}
        >
          {t('hero.subPrefix')}
          <span style={{ color: 'var(--ink-100)', fontWeight: 500 }}>{t('hero.subPercent')}</span>
          {t('hero.subMid')}
          <span style={{ color: 'var(--ink-100)', fontWeight: 500 }}>{t('hero.subOcufi')}</span>
          {t('hero.subSuffix')}
        </p>

        <div className="flex gap-3 justify-center mb-8 flex-wrap">
          <MetalButton size="lg" onClick={onConnect}>
            {t('hero.ctaPrimary')}
          </MetalButton>
          <GhostButton
            size="lg"
            onClick={() => {
              const el = document.getElementById('home-demo');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {t('hero.ctaSecondary')}
          </GhostButton>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            fontSize: '12px',
            color: 'var(--ink-40)',
            letterSpacing: '0.04em',
          }}
        >
          {t('hero.trustA')} · {t('hero.trustB')} ·{' '}
          <span style={{ color: 'var(--ink-60)' }}>{t('hero.trustC')}</span>
        </div>
      </div>
    </section>
  );
}

// ─── Demo 对比(第 2 屏) ──────────────────────────────

function DemoSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  const themRows: DemoCompareRow[] = [
    { label: t('demo.rowPrincipal'), value: '1.000 SOL' },
    { label: t('demo.rowFee'), value: '— 0.010 SOL' },
    { label: t('demo.rowMev'), value: '— 0.012 SOL' },
    { label: t('demo.rowAta'), value: '— 0.002 SOL' },
  ];
  const usRows: DemoCompareRow[] = [
    { label: t('demo.rowPrincipal'), value: '1.000 SOL' },
    { label: t('demo.rowFee'), value: '— 0.001 SOL' },
    { label: t('demo.rowMev'), value: t('demo.rowMevProtected') },
    { label: t('demo.rowAta'), value: t('demo.rowAtaRefund') },
  ];

  return (
    <section id="home-demo" className="relative" style={{ padding: '128px 0' }}>
      <div className="max-w-[1240px] mx-auto px-14">
        <div className="text-center mb-20">
          <div
            style={{
              fontFamily: 'var(--font-geist), sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(36px, 4.5vw, 56px)',
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
              marginBottom: '16px',
              color: 'var(--ink-100)',
            }}
          >
            {t('demo.titlePrefix')}
            <ItalicAccent variant="green">{t('demo.titleAccent')}</ItalicAccent>
          </div>
          <div style={{ fontSize: '16px', color: 'var(--ink-60)', letterSpacing: '-0.005em' }}>
            {t('demo.subtitle')}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 60px minmax(0, 1fr)',
            gap: '20px',
            alignItems: 'stretch',
          }}
        >
          <DemoCompareCard
            variant="them"
            brandLabel={t('demo.themLabel')}
            name={t('demo.themName')}
            meta={t('demo.themMeta')}
            rows={themRows}
            totalLabel={t('demo.rowTotal')}
            totalValue="1.024 SOL"
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-newsreader), Georgia, serif',
              fontSize: '36px',
              color: 'var(--ink-40)',
              fontStyle: 'italic',
            }}
          >
            →
          </div>
          <DemoCompareCard
            variant="us"
            brandLabel={t('demo.usLabel')}
            name={t('demo.usName')}
            meta={t('demo.usMeta')}
            rows={usRows}
            totalLabel={t('demo.rowTotal')}
            totalValue="1.001 SOL"
          />
        </div>

        {/* 底部 "你省了" 大数字 */}
        <div
          style={{
            marginTop: '64px',
            textAlign: 'center',
            padding: '48px',
            background: 'linear-gradient(180deg, var(--brand-soft) 0%, transparent 100%)',
            border: '1px solid var(--border-brand)',
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          className="relative z-[2]"
        >
          <div
            style={{
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
              fontSize: '12px',
              color: 'var(--brand-up)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            {t('demo.savingsLabel')}
          </div>
          <div style={{ marginBottom: '12px' }}>
            <HeroNumber value={0.023} size={88} unit="SOL" decimals={3} />
          </div>
          <div
            style={{
              fontSize: '14px',
              color: 'var(--ink-60)',
              fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            }}
          >
            {t('demo.savingsMeta')}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 三大优势(第 3 屏) ──────────────────────────────

function PillarsSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <section style={{ padding: '128px 0' }}>
      <div className="max-w-[1240px] mx-auto px-14">
        <div className="text-center mb-20">
          <div
            style={{
              fontFamily: 'var(--font-geist), sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(36px, 4.5vw, 56px)',
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
              color: 'var(--ink-100)',
            }}
          >
            {t('pillars.titlePrefix')}
            <ItalicAccent variant="green">{t('pillars.titleAccent')}</ItalicAccent>
            {t('pillars.titleSuffix')}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '20px',
          }}
        >
          <PillarCard
            num="01"
            title={t('pillars.p1Title')}
            desc={t('pillars.p1Desc')}
            stat={t('pillars.p1Stat')}
          />
          <PillarCard
            num="02"
            title={t('pillars.p2Title')}
            desc={t('pillars.p2Desc')}
            stat={t('pillars.p2Stat')}
          />
          <PillarCard
            num="03"
            title={t('pillars.p3Title')}
            desc={t('pillars.p3Desc')}
            stat={t('pillars.p3Stat')}
          />
        </div>
      </div>
    </section>
  );
}

// ─── 社会证明(第 4 屏 · 接 /public_stats 真数据) ──────────────────────

function SocialSection({
  t,
  stats,
}: {
  t: ReturnType<typeof useTranslations>;
  stats: PublicStats | null;
}) {
  const traderCount = stats?.total_users_saved_count ?? stats?.total_wallets ?? 0;
  const savedSol = stats?.total_saved_sol ?? 0;
  const savedUsd = stats?.total_saved_usd ?? 0;

  return (
    <section style={{ padding: '96px 0', textAlign: 'center' }}>
      <div className="max-w-[1240px] mx-auto px-14">
        <div
          className="relative z-[2]"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-v2)',
            borderRadius: '20px',
            padding: '64px 48px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '40px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <SocialStat label={t('social.trader')}>
            <HeroNumber value={traderCount} size={56} color="var(--brand-up)" decimals={0} />
          </SocialStat>
          <SocialStat label={t('social.saved')}>
            <HeroNumber value={savedSol} size={56} color="var(--ink-100)" unit="SOL" decimals={3} />
          </SocialStat>
          <SocialStat label={t('social.savedUsd')}>
            <HeroNumber value={savedUsd} size={56} color="var(--ink-100)" unit="USD" decimals={2} />
          </SocialStat>
        </div>
        {/* P5-FE-19 · 诚信脚注 · saved 算法基准说明 · 不点名竞品 */}
        <div
          style={{
            marginTop: '16px',
            fontSize: '11px',
            color: 'var(--ink-40)',
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            letterSpacing: '0.04em',
            textAlign: 'center',
          }}
        >
          {t('social.footnote')}
        </div>
      </div>
    </section>
  );
}

function SocialStat({ children, label }: { children: React.ReactNode; label: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: '12px' }}>{children}</div>
      <div
        style={{
          fontSize: '13px',
          color: 'var(--ink-60)',
          fontFamily: 'var(--font-geist-mono), Menlo, monospace',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── 末尾 CTA(第 5 屏) ──────────────────────────────

function FinalCtaSection({
  t,
  onConnect,
}: {
  t: ReturnType<typeof useTranslations>;
  onConnect: () => void;
}) {
  return (
    <section
      className="relative"
      style={{ padding: '144px 0 192px', textAlign: 'center' }}
    >
      {/* 中心光晕 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 50% 60% at 50% 50%, var(--brand-soft) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div className="max-w-[1240px] mx-auto px-14 relative z-[2]">
        <div
          style={{
            fontFamily: 'var(--font-geist), sans-serif',
            fontSize: '56px',
            fontWeight: 500,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            marginBottom: '24px',
            color: 'var(--ink-100)',
          }}
        >
          {t('finalCta.titlePrefix')}
          <ItalicAccent variant="green">{t('finalCta.titleAccent')}</ItalicAccent>
          {t('finalCta.titleSuffix')}
        </div>
        <div
          style={{
            fontSize: '16px',
            color: 'var(--ink-60)',
            marginBottom: '40px',
          }}
        >
          {t('finalCta.sub')}
        </div>
        <MetalButton size="xl" onClick={onConnect}>
          {t('finalCta.cta')}
        </MetalButton>
        <div
          style={{
            marginTop: '24px',
            fontSize: '12px',
            color: 'var(--ink-40)',
            fontFamily: 'var(--font-geist-mono), Menlo, monospace',
            letterSpacing: '0.04em',
          }}
        >
          {t('finalCta.trust')}
        </div>
      </div>
    </section>
  );
}
