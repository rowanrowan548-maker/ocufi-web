'use client';

/**
 * V2 Token Side Shell · 右栏 · V2 GlassCard 包 V1 AuditCards
 *
 * mobile column 堆到底(globals 媒查 .v2-token-grid)
 *
 * Phase 2 内 audit-cards 全字段已展示 · V2 玻璃容器把视觉气质拉过来
 * V1 RightInfoTabs 后续考虑加(持仓集中度 + 最近交易 · 但 audit-cards 已含部分)
 */
import { AuditCards } from '@/components/trade/audit-cards';

type Props = { mint: string };

export function TokenSideShell({ mint }: Props) {
  return (
    <aside className="v2-card v2-token-side">
      <h3
        style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--ink-60)',
          marginBottom: 14,
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
        }}
      >
        安全信息
      </h3>
      <AuditCards mint={mint} />
    </aside>
  );
}
