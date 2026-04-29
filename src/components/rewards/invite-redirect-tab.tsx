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
      <CardContent
        className="p-6 text-center space-y-3"
        data-testid="invite-redirect"
      >
        <Users className="h-10 w-10 mx-auto text-[var(--brand-up)]/70" />
        <div className="text-sm font-medium">{t('title')}</div>
        <div className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          {t('desc')}
        </div>
        <div className="pt-1">
          <Link
            href="/invite"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--brand-up)]/15 text-[var(--brand-up)] text-sm font-medium hover:bg-[var(--brand-up)]/25 transition-colors"
            data-testid="invite-go"
          >
            {t('cta')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
