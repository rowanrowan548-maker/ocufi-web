'use client';

/**
 * 代币标签 · NEW / 🔥 / ⚠️ / ✅
 *
 * 规则(简单可解释):
 *  - ✅ VERIFIED:在白名单里
 *  - 🔥 HOT:24h 涨幅 > 30% 或 24h 成交量 > $5M
 *  - ⚠️ WARN:24h 跌幅 > 30% 或流动性 < $50K
 *  - NEW:pair 创建 < 7 天
 *
 * 同一行可能命中多个标签,按优先级:VERIFIED > NEW > HOT > WARN
 */
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
    <span className="inline-flex items-center gap-1 flex-wrap">
      {shown.map((k) => <Tag key={k} kind={k} />)}
    </span>
  );
}

function Tag({ kind }: { kind: TagKind }) {
  const map: Record<TagKind, { label: string; className: string }> = {
    verified: {
      label: '✓',
      className: 'bg-success/15 text-success border-success/30',
    },
    new: {
      label: 'NEW',
      className: 'bg-primary/15 text-primary border-primary/30',
    },
    hot: {
      label: '🔥',
      className: 'bg-danger/15 text-danger border-danger/30',
    },
    warn: {
      label: '⚠',
      className: 'bg-warning/15 text-warning border-warning/30',
    },
  };
  const cfg = map[kind];
  return (
    <span
      className={`inline-flex items-center px-1 py-px rounded-sm border text-[9px] font-bold leading-none ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
