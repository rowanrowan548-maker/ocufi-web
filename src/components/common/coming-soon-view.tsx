'use client';

/**
 * T-908a · 通用 Coming Soon 占位页(给 trending / copy / radar 共用)
 *
 * 收 string icon name(避免 LucideIcon 函数在 server → client 序列化报错)
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  iconName?: string;
  titleKey: string;
  descKey: string;
}

type LucideComponent = React.FC<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export function ComingSoonView({ iconName = 'Sparkles', titleKey, descKey }: Props) {
  const t = useTranslations();
  const IconLib = Icons as unknown as Record<string, LucideComponent>;
  const Icon = IconLib[iconName] ?? IconLib.Sparkles;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Icon className="h-10 w-10 text-primary" strokeWidth={1.5} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t(titleKey)}</h1>
      <p className="text-sm text-muted-foreground mb-1 max-w-md">{t(descKey)}</p>
      <div className="text-[11px] uppercase tracking-wider text-primary/80 font-mono mb-8">
        {t('nav.comingSoon')}
      </div>
      <Link href="/trade">
        <Button variant="outline" size="sm">
          {t('nav.backHome')}
        </Button>
      </Link>
    </div>
  );
}
