'use client';

/**
 * T-FE-STALE-UI · 后端返回 stale 旧数据时的小灰条
 *
 * 后端 fallback (T-PERF-STALE-FALLBACK · 29e0e00):上游失败时返回旧数据,带:
 *   { ok:true, stale:true, data_age_sec:300, ... }
 *
 * UI:卡片顶部 1 行 · `数据约 X 分钟前 · 自动刷新中`
 */
import { useTranslations } from 'next-intl';

interface Props {
  stale?: boolean | null;
  dataAgeSec?: number | null;
}

export function StaleBar({ stale, dataAgeSec }: Props) {
  const t = useTranslations('trade.stale');
  if (!stale) return null;
  const min = Math.max(1, Math.round((dataAgeSec ?? 0) / 60));
  return (
    <div
      data-testid="stale-bar"
      className="text-[10px] text-muted-foreground/70 bg-muted/30 px-2 py-1 rounded -mx-1"
    >
      {t('label', { min })}
    </div>
  );
}
