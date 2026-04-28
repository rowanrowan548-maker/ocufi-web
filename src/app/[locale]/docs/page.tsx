import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Wallet, ShoppingCart, ListOrdered, Shield, Zap, Star, ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DocImagePlaceholder } from '@/components/docs/doc-image-placeholder';

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

  const sections: Array<{
    Icon: typeof Wallet;
    titleKey: string;
    bodyKey: string;
    href?: string;
    cta?: string;
    /** T-980-117 · 章节配图(留 src 占位 · 用户后续录 GIF / 截图后改 src 即可)*/
    image?: { src?: string; altKey: string; aspect?: '16/9' | '4/3' };
  }> = [
    {
      Icon: Wallet,
      titleKey: 'connect.title',
      bodyKey: 'connect.body',
      href: '/portfolio',
      cta: 'connect.cta',
      image: { altKey: 'connect.imageAlt' },
    },
    {
      Icon: ShoppingCart,
      titleKey: 'buy.title',
      bodyKey: 'buy.body',
      href: '/trade',
      cta: 'buy.cta',
      image: { altKey: 'buy.imageAlt' },
    },
    {
      Icon: ListOrdered,
      titleKey: 'sell.title',
      bodyKey: 'sell.body',
      href: '/portfolio',
      cta: 'sell.cta',
      image: { altKey: 'sell.imageAlt' },
    },
    {
      Icon: Zap,
      titleKey: 'limit.title',
      bodyKey: 'limit.body',
      href: '/trade',
      cta: 'limit.cta',
      image: { altKey: 'limit.imageAlt' },
    },
    {
      Icon: Shield,
      titleKey: 'safety.title',
      bodyKey: 'safety.body',
      href: '/token',
      cta: 'safety.cta',
      image: { altKey: 'safety.imageAlt' },
    },
    {
      Icon: Star,
      titleKey: 'watchlist.title',
      bodyKey: 'watchlist.body',
      href: '/watchlist',
      cta: 'watchlist.cta',
      image: { altKey: 'watchlist.imageAlt' },
    },
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

        <div className="space-y-4">
          {sections.map((s, i) => (
            <Card key={i} className="p-5 sm:p-6">
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

        <div className="text-xs text-muted-foreground/70 text-center pt-6 border-t border-border/40">
          {t('footer')}
        </div>
      </div>
    </main>
  );
}
