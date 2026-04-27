'use client';

/**
 * T-906b · 新徽章解锁 toast
 *
 * 在 swap 成功 + claimPoints 拿到 newBadges 后调用,sonner toast 显示
 *   <BadgeIcon size={48} /> + "新徽章解锁:{name}"
 * 点 toast 跳 /badges
 */
import { toast } from 'sonner';
import { BadgeIcon } from '@/components/badges/badge-icon';
import type { ClaimedBadge } from '@/lib/api-client';

interface ToastBadgeArgs {
  badges: ClaimedBadge[];
  locale: string;
  unlockedTitle: string;
  goBadgesLabel: string;
}

export function showBadgeToasts({
  badges,
  locale,
  unlockedTitle,
  goBadgesLabel,
}: ToastBadgeArgs) {
  if (!badges?.length) return;
  const isZh = locale.startsWith('zh');
  for (const b of badges) {
    const name = isZh ? b.nameZh : b.nameEn;
    toast.custom(
      (id) => (
        <div className="flex items-center gap-3 p-3 rounded-md border border-success/30 bg-card shadow-lg">
          <BadgeIcon icon={b.icon} rarity={b.rarity} earned size={48} />
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-success font-mono">
              {unlockedTitle}
            </span>
            <span className="font-medium text-sm truncate">{name}</span>
            <a
              href="/badges"
              onClick={() => toast.dismiss(id)}
              className="text-[11px] text-primary hover:underline mt-0.5 self-start"
            >
              {goBadgesLabel} →
            </a>
          </div>
        </div>
      ),
      { duration: 6000 }
    );
  }
}
