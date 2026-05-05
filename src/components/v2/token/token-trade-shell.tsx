'use client';

/**
 * V2 Token Trade Shell · V2 GlassCard 容器 · 内嵌 V1 BuyForm(全功能 swap)
 *
 * 复用 V1 swap 全套(swap-with-fee + helius-sender + mev-protection + execute-swap-plan + trade-tx)
 * 链上 lib 0 改 · 直接 import V1 BuyForm(已封装完整 buy/sell pipeline)
 *
 * V2 phase 2 ship · 视觉上 shell 是 V2 玻璃 + brand glow · 内 BuyForm 仍 V1 shadcn 样式
 * 后续 P3 起再考虑全 V2 重写 trade form(代价高 · 不在当前 budget 内)
 */
import { BuyForm } from '@/components/trade/buy-form';

type Props = { mint: string };

export function TokenTradeShell({ mint }: Props) {
  return (
    <div
      className="v2-token-trade"
      style={{
        padding: 24,
        background: 'var(--bg-card-v2)',
        border: '1px solid var(--border-v2)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-card-v2)',
      }}
    >
      {/* V1 BuyForm 直接嵌入 · compact 模式 · 自带 Buy/Sell tab + 滑点 + 优先费 + 防夹 + Phantom 签 */}
      <BuyForm mint={mint} compact />
    </div>
  );
}
