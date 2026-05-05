/**
 * V2 Home Hero · grid 1fr 460px(桌面) / flex column + order 重排(mobile)
 *
 * 桌面顺序:
 *   左列(home-hero-left):eyebrow + title em + divider + sub + input + chips
 *   右列(home-hero-og):OG 卡装饰 460×320 微浮动
 *
 * mobile 顺序(spec hotfix-2 钦定 670px viewport):
 *   eyebrow → title → divider → OG 卡 mobile → input → chips → sub(推第二屏)
 *
 * mobile 重排靠 CSS class .v2-home-hero(globals.css 媒查)
 */
import { getTranslations } from 'next-intl/server';
import { EyebrowPill } from '@/components/v2/shared/eyebrow-pill';
import { HeroDivider } from '@/components/v2/shared/hero-divider';
import { HomeOgLink } from './home-og-link';
import { HomeInput } from './home-input';
import { HomeRecents } from './home-recents';

export async function HomeHero() {
  const t = await getTranslations('v2.home');

  return (
    <div
      className="v2-home-hero-grid"
      style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: '120px 56px 80px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 460px',
        gap: 80,
        alignItems: 'center',
      }}
    >
      {/* 左列 · home-hero-left · mobile 内部 flex column + order 重排 */}
      <div
        className="v2-home-hero-left"
        style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
      >
        <div className="v2-home-eyebrow" style={{ marginBottom: 28 }}>
          <EyebrowPill>{t('eyebrow')}</EyebrowPill>
        </div>

        <h1
          className="v2-home-title"
          style={{
            fontSize: 'clamp(44px, 5vw, 72px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            fontWeight: 500,
            color: 'var(--ink-100)',
            marginBottom: 24,
          }}
        >
          {t('titleA')}
          <br />
          {t('titleB')}
          <em
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--brand-up)',
              textShadow: '0 0 40px rgba(25,251,155,0.28), 0 0 80px rgba(25,251,155,0.12)',
            }}
          >
            {t('titleEm')}
          </em>
          {t('titleC')}
        </h1>

        <HeroDivider />

        {/* mobile-only OG 卡 · 桌面用右列 .v2-home-hero-og · click 真 sig(没就 demo) */}
        <div className="v2-home-og-mobile" style={{ display: 'none', marginBottom: 24 }}>
          <HomeOgLink
            variant="home-mobile"
            topLabel={t('ogCard.label')}
            saveText={t('ogCard.lineMobile')}
            subText={t('ogCard.sub')}
            footLeft={t('ogCard.footLeft')}
            footRight={t('ogCard.viewLink')}
          />
        </div>

        <p
          className="v2-home-sub"
          style={{
            fontSize: 18,
            color: 'var(--ink-80)',
            maxWidth: 540,
            lineHeight: 1.55,
            marginBottom: 44,
          }}
        >
          {t('sub')}
        </p>

        <div style={{ marginBottom: 24 }}>
          <HomeInput />
        </div>

        {/* RSC · server fetch trending */}
        <HomeRecents />
      </div>

      {/* 右列 · 桌面 OG 卡装饰 · mobile hide(走 .v2-home-og-mobile 在 left 内) · click 真 sig(没就 demo) */}
      <div className="v2-home-hero-og">
        <HomeOgLink
          variant="home-hero"
          topLabel={t('ogCard.label')}
          saveText={t('ogCard.line')}
          subText={t('ogCard.sub')}
          footLeft={t('ogCard.footLeft')}
          footRight={t('ogCard.viewLink')}
        />
      </div>
    </div>
  );
}
