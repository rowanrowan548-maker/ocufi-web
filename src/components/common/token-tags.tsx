'use client';

/**
 * 代币标签 · 精致版(图标 + 极简徽章,色调匹配品牌绿/警示)
 *
 * 规则(简单可解释):
 *  - VERIFIED:在白名单里
 *  - NEW:pair 创建 < 7 天
 *  - HOT:24h 涨幅 > 30% 或 24h 成交量 > $5M
 *  - WARN:24h 跌幅 > 30% 或流动性 < $50K
 *
 * 优先级:VERIFIED > NEW > HOT > WARN(同行最多显 2 个)
 */
import { BadgeCheck, Sparkles, Flame, AlertTriangle } from 'lucide-react';
import { isVerifiedToken } from '@/lib/verified-tokens';
import type { TokenInfo } from '@/lib/portfolio';

const NEW_THRESHOLD_MS = 7 * 24 * 3600 * 1000;
const HOT_PCT = 30;
const HOT_VOLUME = 5_000_000;
const WARN_PCT = -30;
const WARN_LIQ = 50_000;

export type TagKind = 'verified' | 'new' | 'hot' | 'warn';

export function tagsFor(t: TokenInfo): TagKind[] {
  const out: TagKind[] = [];
  if (isVerifiedToken(t.mint)) out.push('verified');
  if (t.pairCreatedAt && Date.now() - t.pairCreatedAt < NEW_THRESHOLD_MS) {
    out.push('new');
  }
  if (
    (t.priceChange24h != null && t.priceChange24h >= HOT_PCT) ||
    (t.volume24h ?? 0) >= HOT_VOLUME
  ) {
    out.push('hot');
  }
  if (
    (t.priceChange24h != null && t.priceChange24h <= WARN_PCT) ||
    (t.liquidityUsd ?? 0) < WARN_LIQ
  ) {
    out.push('warn');
  }
  return out;
}

interface TagProps {
  kinds: TagKind[];
  /** 最多显示几个,超出截断 */
  max?: number;
}

export function TokenTags({ kinds, max = 2 }: TagProps) {
  if (kinds.length === 0) return null;
  const shown = kinds.slice(0, max);
  return (
    <span className="inline-flex items-center gap-1">
      {shown.map((k) => <Tag key={k} kind={k} />)}
    </span>
  );
}

const TAG_CONFIG: Record<
  TagKind,
  { Icon: typeof BadgeCheck; className: string; title: string }
> = {
  verified: {
    Icon: BadgeCheck,
    // 品牌绿,纯图标无文字 — 蓝筹币常见,保持低调
    className: 'text-primary',
    title: 'Verified · 白名单代币',
  },
  new: {
    Icon: Sparkles,
    // 紫色 accent,跟绿主色和谐区分
    className: 'text-[oklch(0.75_0.18_280)]',
    title: 'NEW · pair 创建 < 7 天',
  },
  hot: {
    Icon: Flame,
    // 暖橙,强烈吸睛但不抢主色
    className: 'text-[oklch(0.75_0.2_45)]',
    title: 'HOT · 高成交或大涨',
  },
  warn: {
    Icon: AlertTriangle,
    className: 'text-warning',
    title: 'WARN · 大跌或流动性低',
  },
};

function Tag({ kind }: { kind: TagKind }) {
  const cfg = TAG_CONFIG[kind];
  return (
    <span
      className={`inline-flex items-center justify-center h-4 w-4 ${cfg.className}`}
      title={cfg.title}
      aria-label={cfg.title}
    >
      <cfg.Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}
