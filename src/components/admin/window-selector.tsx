'use client';

/**
 * T-FE-ADMIN-TRADE-VOLUME-CARD · 抽出 admin 卡片共享 4 chip 窗口选择器
 *
 * 现 fee-revenue-card / trade-volume-card 用 · 后续 BI 也复用
 * 视觉 / 触控跟 fee-revenue-card v1 一致 · 不要带 Tabs / dropdown 等"重组件"
 */
import type { FeeRevenueWindow } from '@/lib/api-client';

// 直接复用 fee-revenue 那条 type alias · 4 个值是 admin 全局共识
export type AdminWindow = FeeRevenueWindow;

const WINDOWS: { key: AdminWindow; label: string }[] = [
  { key: '24h', label: '24 小时' },
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: 'all', label: '全部' },
];

interface Props {
  value: AdminWindow;
  onChange: (w: AdminWindow) => void;
  /** 给 data-testid 加前缀避免同页多卡冲突 · 默认 admin-window */
  testIdPrefix?: string;
}

export function WindowSelector({ value, onChange, testIdPrefix = 'admin-window' }: Props) {
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label="时间窗口">
      {WINDOWS.map((w) => {
        const active = w.key === value;
        return (
          <button
            key={w.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`${testIdPrefix}-${w.key}`}
            onClick={() => onChange(w.key)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              active
                ? 'bg-[var(--brand-up)]/15 text-[var(--brand-up)]'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {w.label}
          </button>
        );
      })}
    </div>
  );
}
