'use client';

/**
 * T-906b · 已获得徽章 hook(给 portfolio mini wall 用)
 *
 * 合并 /badges/me + /badges/all → 返回带 icon/rarity 的已得徽章列表
 */
import { useEffect, useState } from 'react';
import {
  fetchAllBadges,
  fetchMyBadges,
  isApiConfigured,
  type BadgeRarity,
} from '@/lib/api-client';

export interface EarnedBadge {
  code: string;
  nameZh: string;
  nameEn: string;
  icon: string;
  rarity: BadgeRarity;
  earnedAt: string;
}

interface State {
  earned: EarnedBadge[];
  loading: boolean;
}

export function useBadges(walletAddr: string | null): State {
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddr || !isApiConfigured()) {
      setEarned([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [allResp, meResp] = await Promise.all([
          fetchAllBadges(),
          fetchMyBadges(walletAddr),
        ]);
        if (cancelled) return;
        const defs = new Map(allResp.badges.map((b) => [b.code, b]));
        const out: EarnedBadge[] = [];
        for (const e of meResp.earned ?? []) {
          const d = defs.get(e.code);
          if (!d) continue;
          out.push({
            code: d.code,
            nameZh: d.nameZh,
            nameEn: d.nameEn,
            icon: d.icon,
            rarity: d.rarity,
            earnedAt: e.earnedAt,
          });
        }
        setEarned(out);
      } catch {
        if (!cancelled) setEarned([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddr]);

  return { earned, loading };
}
