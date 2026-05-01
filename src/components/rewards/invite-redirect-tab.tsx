'use client';

/**
 * T-REWARDS-PAGE · Tab 3 · 邀请返佣
 *
 * V1 简单版:卡片 + CTA 跳 /invite(避免 iframe 跨域 + auth 问题)
 * 不自动 redirect · 让用户主动选(防误触从奖励中心跳走)
 */
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function InviteRedirectTab() {
  const t = useTranslations('rewards.invite');

  return (
    <Card>
      {/* T-FE-MOBILE-RESCUE-P0:CTA 全宽(< sm)+ 触控 ≥ 48px · icon 居中 */}
      <CardContent
        className="p-6 text-center space-y-3"
        data-testid="invite-redirect"
      >
        <Users className="h-12 w-12 sm:h-10 sm:w-10 mx-auto text-[var(--brand-up)]/70" />
        <div className="text-base sm:text-sm font-medium">{t('title')}</div>
        <div className="text-sm sm:text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          {t('desc')}
        </div>
        <div className="pt-1">
          <Link
            href="/invite"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-6 h-12 sm:h-10 rounded-md bg-[var(--brand-up)]/15 text-[var(--brand-up)] text-sm font-medium hover:bg-[var(--brand-up)]/25 active:bg-[var(--brand-up)]/30 transition-colors"
            data-testid="invite-go"
          >
            {t('cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
