'use client';

/**
 * V2 Token Trade Shell · V2 GlassCard 容器 · 内嵌 V1 TradeTabs(Buy/Sell · marketOnly 砍限价 MUST NOT DO 第 5 条)
 *
 * 复用 V1 swap 全套(swap-with-fee + helius-sender + mev-protection + execute-swap-plan + trade-tx)
 * 链上 lib 0 改 · 直接 import V1 TradeTabs(已封装完整 buy/sell pipeline + Tab 切换)
 *
 * P2-HOTFIX:接 ?action=sell URL · defaultSide 传到 TradeTabs · 持仓页 click 行直跳卖出
 *
 * 视觉上 shell 是 V2 玻璃 + brand glow · 内 TradeTabs 仍 V1 shadcn 样式
 * 底部留 "查看交易报告 demo" 链接(Phase 3 后改 swap 成功 callback 拿真 sig)
 */
import Link from 'next/link';
import { TradeTabs } from '@/components/trade/trade-tabs';
import { MOCK_TX_SIG } from '@/components/v2/shared/mock-sig';

type Props = { mint: string; defaultSide?: 'buy' | 'sell' };

export function TokenTradeShell({ mint, defaultSide }: Props) {
  return (
    <div className="v2-card v2-token-trade">
      {/* V1 TradeTabs · compact + chromeless · marketOnly 砍内层"市价/限价" tab(MUST NOT DO 第 5 条 · V2 不做 limit)
          chromeless · V2 .v2-card 已提供外 chrome · V1 内 Card 必须砍干净 · 防双 chrome 错位
          自带 Buy/Sell + 滑点 + 优先费 + 防夹 + Phantom 签 */}
      <TradeTabs mint={mint} compact chromeless defaultSide={defaultSide} marketOnly />

      {/* 查看 demo 报告 · Phase 3 后改 swap 成功 callback → 真 sig */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid var(--border-v2)',
          textAlign: 'center',
        }}
      >
        <Link
          href={`/v2/tx/${MOCK_TX_SIG}`}
          prefetch={false}
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 11,
            color: 'var(--brand-up)',
            textDecoration: 'none',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          查看交易报告 demo →
        </Link>
      </div>
    </div>
  );
}
