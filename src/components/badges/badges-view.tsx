'use client';

/**
 * T-905b · /badges 占位页
 *
 * V1 5 枚徽章占位:早鸟 / 首单 / 百单 / 拉新王 / PnL 王
 * 全部置灰 + Coming Soon · T-906b 接入后端 API 后升级
 */
import { Sun, Gem, Rocket, Users, Trophy, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';

interface PlaceholderBadge {
  key: string;
  Icon: LucideIcon;
}

const BADGES: PlaceholderBadge[] = [
  { key: 'earlyBird', Icon: Sun },
  { key: 'firstTrade', Icon: Gem },
  { key: 'hundredTrades', Icon: Rocket },
  { key: 'inviteKing', Icon: Users },
  { key: 'pnlKing', Icon: Trophy },
];

export function BadgesView() {
  const t = useTranslations();
  return (
    <div className="w-full max-w-4xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {BADGES.map(({ key, Icon }) => (
          <Card
            key={key}
            className="opacity-50 hover:opacity-70 transition-opacity"
          >
            <CardContent className="py-5 flex flex-col items-center text-center gap-2">
              <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center">
                <Icon className="h-7 w-7 text-muted-foreground/60" strokeWidth={1.5} />
              </div>
              <div className="font-medium text-sm">
                {t(`badges.list.${key}.name`)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                {t('badges.comingSoon')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground/60 mt-6">
        {t('badges.note')}
      </p>
    </div>
  );
}
