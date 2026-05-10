import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Wallet, ShoppingCart, ListOrdered, Shield, Zap, Star, ArrowRight,
  AlertTriangle, Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DocImagePlaceholder } from '@/components/docs/doc-image-placeholder';
import { DocsSearch } from '@/components/docs/docs-search';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('docs.title') };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('docs');

  // T-980-119 · 按用户痛点优先级重排:第一笔交易 → 钱包 → 卖出 → 限价 → 安全 → 自选
  // 不动文案(i18n bodyKey 不变),只调顺序 + 加 TOC
  const sections: Array<{
    /** T-980-118 · 锚点 ID · DocsSearch 跳转目标(BE → FE 映射用) */
    id: string;
    Icon: typeof Wallet;
    titleKey: string;
    bodyKey: string;
    href?: string;
    cta?: string;
    /** T-980-117 · 章节配图(留 src 占位 · 用户后续录 GIF / 截图后改 src 即可)*/
    image?: { src?: string; altKey: string; aspect?: '16/9' | '4/3' };
  }> = [
    {
      id: 'section-buy',
      Icon: ShoppingCart,
      titleKey: 'buy.title',
      bodyKey: 'buy.body',
      href: '/trade',
      cta: 'buy.cta',
      image: { altKey: 'buy.imageAlt' },
    },
    {
      id: 'section-connect',
      Icon: Wallet,
      titleKey: 'connect.title',
      bodyKey: 'connect.body',
      href: '/portfolio',
      cta: 'connect.cta',
      image: { altKey: 'connect.imageAlt' },
    },
    {
      id: 'section-sell',
      Icon: ListOrdered,
      titleKey: 'sell.title',
      bodyKey: 'sell.body',
      href: '/portfolio',
      cta: 'sell.cta',
      image: { altKey: 'sell.imageAlt' },
    },
    {
      id: 'section-limit',
      Icon: Zap,
      titleKey: 'limit.title',
      bodyKey: 'limit.body',
      href: '/trade',
      cta: 'limit.cta',
      image: { altKey: 'limit.imageAlt' },
    },
    {
      id: 'section-safety',
      Icon: Shield,
      titleKey: 'safety.title',
      bodyKey: 'safety.body',
      href: '/token',
      cta: 'safety.cta',
      image: { altKey: 'safety.imageAlt' },
    },
    {
      id: 'section-watchlist',
      Icon: Star,
      titleKey: 'watchlist.title',
      bodyKey: 'watchlist.body',
      href: '/watchlist',
      cta: 'watchlist.cta',
      image: { altKey: 'watchlist.imageAlt' },
    },
  ];

  // T-980-120 · 常见错误故障排查 · 5 子项 症状 → 原因 → 解法
  const errorItems: Array<{ id: string; titleKey: string; symptomKey: string; causeKey: string; fixKey: string }> = [
    { id: 'err-tx-failed', titleKey: 'errors.txFailed.title', symptomKey: 'errors.txFailed.symptom', causeKey: 'errors.txFailed.cause', fixKey: 'errors.txFailed.fix' },
    { id: 'err-holding-delay', titleKey: 'errors.holdingDelay.title', symptomKey: 'errors.holdingDelay.symptom', causeKey: 'errors.holdingDelay.cause', fixKey: 'errors.holdingDelay.fix' },
    { id: 'err-withdraw', titleKey: 'errors.withdraw.title', symptomKey: 'errors.withdraw.symptom', causeKey: 'errors.withdraw.cause', fixKey: 'errors.withdraw.fix' },
    { id: 'err-slippage', titleKey: 'errors.slippage.title', symptomKey: 'errors.slippage.symptom', causeKey: 'errors.slippage.cause', fixKey: 'errors.slippage.fix' },
    { id: 'err-wallet-disconnect', titleKey: 'errors.walletDisconnect.title', symptomKey: 'errors.walletDisconnect.symptom', causeKey: 'errors.walletDisconnect.cause', fixKey: 'errors.walletDisconnect.fix' },
  ];

  // T-980-121 · 高级技巧 · 3 子项
  const advancedItems: Array<{ id: string; titleKey: string; bodyKey: string }> = [
    { id: 'adv-priority-fee', titleKey: 'advanced.priorityFee.title', bodyKey: 'advanced.priorityFee.body' },
    { id: 'adv-mev', titleKey: 'advanced.mev.title', bodyKey: 'advanced.mev.body' },
    { id: 'adv-copy-trade', titleKey: 'advanced.copyTrade.title', bodyKey: 'advanced.copyTrade.body' },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>

        {/* T-980-118 · sticky 全文搜索框(后端 /search/docs)+ Cmd+K */}
        <DocsSearch />

        {/* T-980-119 · TOC 目录 · 按用户痛点优先级排序的快速跳转 */}
        <nav aria-label={t('toc')} className="rounded-lg border border-border/40 bg-card/40 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2 font-medium">
            {t('toc')}
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm list-decimal list-inside">
            {sections.map((s, i) => (
              <li key={i}>
                <a
                  href={`#${s.id}`}
                  className="text-foreground/80 hover:text-primary hover:underline transition-colors"
                >
                  {t(s.titleKey)}
                </a>
              </li>
            ))}
            <li>
              <a href="#section-errors" className="text-foreground/80 hover:text-primary hover:underline transition-colors">
                {t('errors.title')}
              </a>
            </li>
            <li>
              <a href="#section-advanced" className="text-foreground/80 hover:text-primary hover:underline transition-colors">
                {t('advanced.title')}
              </a>
            </li>
          </ol>
        </nav>

        <div className="space-y-4">
          {sections.map((s, i) => (
            <Card key={i} id={s.id} className="p-5 sm:p-6 scroll-mt-24">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <s.Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {i + 1}. {t(s.titleKey)}
                  </h2>
                  <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    {t(s.bodyKey).split(/\n\n+/).map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                  </div>
                  {s.image && (
                    <div className="pt-2">
                      <DocImagePlaceholder
                        src={s.image.src}
                        alt={t(s.image.altKey)}
                        aspect={s.image.aspect ?? '16/9'}
                      />
                    </div>
                  )}
                  {s.href && s.cta && (
                    <div className="pt-1">
                      <Link
                        href={s.href}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {t(s.cta)}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* T-980-120 · 常见错误故障排查 */}
        <Card id="section-errors" className="p-5 sm:p-6 scroll-mt-24">
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{t('errors.title')}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('errors.intro')}</p>
              <ul className="space-y-3">
                {errorItems.map((it) => (
                  <li key={it.id} id={it.id} className="rounded-md border border-border/40 bg-card/40 p-3 scroll-mt-24">
                    <div className="text-sm font-medium mb-1.5">{t(it.titleKey)}</div>
                    <dl className="text-xs text-muted-foreground space-y-1 leading-relaxed">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground/70 flex-shrink-0">{t('errors.labels.symptom')}</dt>
                        <dd>{t(it.symptomKey)}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground/70 flex-shrink-0">{t('errors.labels.cause')}</dt>
                        <dd>{t(it.causeKey)}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-success flex-shrink-0">{t('errors.labels.fix')}</dt>
                        <dd className="text-foreground/80">{t(it.fixKey)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* T-980-121 · 高级技巧 */}
        <Card id="section-advanced" className="p-5 sm:p-6 scroll-mt-24">
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{t('advanced.title')}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('advanced.intro')}</p>
              <ul className="space-y-3">
                {advancedItems.map((it) => (
                  <li key={it.id} id={it.id} className="rounded-md border border-border/40 bg-card/40 p-3 scroll-mt-24">
                    <div className="text-sm font-medium mb-1">{t(it.titleKey)}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
                      {t(it.bodyKey).split(/\n\n+/).map((p, j) => <p key={j}>{p}</p>)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <div className="text-xs text-muted-foreground/70 text-center pt-6 border-t border-border/40">
          {t('footer')}
        </div>
      </div>
    </main>
  );
}
