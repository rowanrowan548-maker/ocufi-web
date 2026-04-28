import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import {
  Shield, ArrowRight,
  LineChart, Star, Wallet, Award, Trophy, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getCurrentChain } from '@/config/chains';
import { TokenList } from '@/components/landing/token-list';
import { OurPromise } from '@/components/landing/our-promise';
import { StatsBar } from '@/components/landing/stats-bar';
import { HeroCASearch } from '@/components/landing/hero-ca-search';
import { XIcon, TelegramIcon, GithubIcon } from '@/components/brand/social-icons';
import { FooterVersion } from '@/components/landing/footer-version';

export default async function Landing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const chain = getCurrentChain();

  // T-927 #10:主推 3(交易/查币/自选)+ 次要 3(限价/积分/邀请)双层视觉
  const primaryFuncs = [
    { href: '/trade', Icon: LineChart, key: 'trade' },
    { href: '/token', Icon: Shield, key: 'tokenCheck' },
    { href: '/watchlist', Icon: Star, key: 'watchlist' },
  ] as const;
  // T-940 R2:删 limit(限价单已整合进 /trade 内 tab,Landing 不该再露出)
  // 用 /badges 替补(徽章系统已 ship,门面更亮)
  const secondaryFuncs = [
    { href: '/points', Icon: Trophy, key: 'points' },
    { href: '/invite', Icon: Users, key: 'invite' },
    { href: '/portfolio', Icon: Wallet, key: 'portfolio' },
    { href: '/badges', Icon: Award, key: 'badges' },
  ] as const;

  return (
    <main className="flex flex-1 flex-col">
      {/* T-927 #11/#1/#2/#3 · Hero 1 屏化:Logo + tagline + 大 CA 搜索 + 热门 chips
          删 PriceTicker(#3)· 删 Features 4 卡(#7)· 删 MarketSnapshot 冗余 */}
      <section className="relative px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 50% 0%, oklch(0.88 0.25 155 / 12%), transparent 70%)',
          }}
        />

        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-5">
          <Badge
            variant="secondary"
            className="text-xs tracking-widest bg-primary/10 border border-primary/20 text-primary"
          >
            {chain.name} · {t('landing.badge')}
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] font-heading">
            {t('landing.hero.title')}
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {t('landing.hero.tagline')}
          </p>

          {/* 大 CA 搜索框 + 热门 token chips · 客户端组件 */}
          <div className="w-full mt-2">
            <HeroCASearch />
          </div>
        </div>
      </section>

      {/* ═══════ Stats Bar · Ocufi 实时聚合数据 ═══════ */}
      <StatsBar />

      {/* ═══════ Token List · trending 直接行情 ═══════ */}
      <TokenList />

      {/* ═══════ Ocufi 的承诺 + 手续费计算器(只算自家费用) ═══════ */}
      <OurPromise />

      {/* T-927 #10 · 能做什么:主推 3 + 次要 4 双层视觉 */}
      <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
              {t('landing.functions.title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('landing.functions.subtitle')}
            </p>
          </div>

          {/* 核心 3 卡(更大、有图标背景) */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3">
              {t('landing.functions.primary')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {primaryFuncs.map(({ href, Icon, key }) => (
                <Link
                  key={href}
                  href={href}
                  className="group rounded-xl border border-primary/30 bg-card p-5 flex items-start gap-3 hover:border-primary/60 hover:bg-card/80 transition"
                >
                  <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold mb-1">
                      {t(`landing.functions.${key}.title`)}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {t(`landing.functions.${key}.desc`)}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* 更多 4 卡(更紧凑、无背景色) */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
              {t('landing.functions.secondary')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {secondaryFuncs.map(({ href, Icon, key }) => (
                <Link
                  key={href}
                  href={href}
                  className="group rounded-lg border border-border/40 bg-card/40 p-3 flex items-center gap-2 hover:border-primary/30 transition"
                >
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {t(`landing.functions.${key}.title`)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ Footer · 四列布局 ═══════ */}
      <footer className="px-4 sm:px-6 py-10 sm:py-12 border-t border-border/40 mt-auto">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* 品牌列 */}
            <div className="col-span-2 md:col-span-1 space-y-3">
              <div className="font-heading font-bold text-lg">Ocufi</div>
              <div className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                {t('brand.tagline')}
              </div>
              <div className="flex gap-3 text-muted-foreground">
                <a
                  href="https://x.com/Ocufi_io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  aria-label="Twitter / X"
                >
                  <XIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://t.me/+HucmvmOx2IswZDBl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  aria-label="Telegram"
                >
                  <TelegramIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://github.com/rowanrowan548-maker/ocufi-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  aria-label="GitHub"
                >
                  <GithubIcon className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* 产品列 */}
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('landing.footer.product')}
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <Link href="/trade" className="block hover:text-foreground">{t('nav.trade')}</Link>
                <Link href="/portfolio" className="block hover:text-foreground">{t('nav.portfolio')}</Link>
                <Link href="/watchlist" className="block hover:text-foreground">{t('nav.watchlist')}</Link>
                <Link href="/badges" className="block hover:text-foreground">{t('nav.badges')}</Link>
                <Link href="/invite" className="block hover:text-foreground">{t('nav.invite')}</Link>
              </div>
            </div>

            {/* 资源列 */}
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('landing.footer.resources')}
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <Link href="/faq" className="block hover:text-foreground">{t('nav.faq')}</Link>
                <Link href="/docs" className="block hover:text-foreground">{t('nav.docs')}</Link>
                <Link href="/status" className="block hover:text-foreground">{t('nav.status')}</Link>
                {/* T-929 #149:Telegram 群链接(社群入口) */}
                <a
                  href="https://t.me/+HucmvmOx2IswZDBl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:text-foreground"
                >
                  Telegram
                </a>
                {/* T-929 #153:GitHub 开源链接(明文 "Open Source · GitHub")*/}
                <a
                  href="https://github.com/rowanrowan548-maker/ocufi-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:text-foreground"
                >
                  {t('landing.footer.openSource')}
                </a>
              </div>
            </div>

            {/* 法律列 */}
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('landing.footer.legal')}
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <Link href="/legal/privacy" className="block hover:text-foreground">{t('legal.footer.privacy')}</Link>
                <Link href="/legal/terms" className="block hover:text-foreground">{t('legal.footer.terms')}</Link>
                <Link href="/legal/disclaimer" className="block hover:text-foreground">{t('legal.footer.disclaimer')}</Link>
                {/* T-964 #151 · 安全审计 checklist */}
                <Link href="/legal/audit" className="block hover:text-foreground">{t('legal.footer.audit')}</Link>
              </div>
            </div>
          </div>

          {/* 底部 · T-963:中文 locale 加 "@ocufi 天眼" 签名(en-US 空)
              T-964 #152:加 fe/be commit + build time(FooterVersion) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] text-muted-foreground/70 pt-6 border-t border-border/40 font-mono">
            <div>
              © {new Date().getFullYear()} Ocufi · {chain.name} · v0.4
              {t('brand.footerSignature') && (
                <span className="ml-2 text-muted-foreground/60">· {t('brand.footerSignature')}</span>
              )}
              {' · '}
              <FooterVersion />
            </div>
            <div>{t('landing.footer.poweredBy')}</div>
          </div>
        </div>
      </footer>
    </main>
  );
}
