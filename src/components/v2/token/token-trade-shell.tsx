'use client';

/**
 * V2 Token Trade Shell · V2 GlassCard 容器 · 内嵌 V1 TradeTabs(Buy/Sell · marketOnly 砍限价 MUST NOT DO 第 5 条)
 *
 * 复用 V1 swap 全套(swap-with-fee + helius-sender + mev-protection + execute-swap-plan + trade-tx)
 * 链上 lib 0 改 · 直接 import V1 TradeTabs(已封装完整 buy/sell pipeline + Tab 切换)
 *
 * P2-HOTFIX:接 ?action=sell URL · defaultSide 传到 TradeTabs · 持仓页 click 行直跳卖出
 *
 * P3-FE-2 bug 2 · 接 onSuccess 真 sig · setLastTxSig 缓存 + 显"查看真报告"链接
 *   - 没 swap 过 → 显 "查看交易报告 demo →"(MOCK_TX_SIG)
 *   - 有 swap 过 → 显 "查看你的交易报告 →"(真 sig)brand 强调
 *
 * 视觉上 shell 是 V2 玻璃 + brand glow · 内 TradeTabs 仍 V1 shadcn 样式
 */
import Link from 'next/link';
import { useState } from 'react';
import { TradeTabs } from '@/components/trade/trade-tabs';
import { MOCK_TX_SIG } from '@/components/v2/shared/mock-sig';
import { useLastTxSig, setLastTxSig } from '@/lib/last-tx-sig';

type Props = { mint: string; defaultSide?: 'buy' | 'sell' };

export function TokenTradeShell({ mint, defaultSide }: Props) {
  // 当前会话内 swap 完成的 sig(实时)· 没就 fallback 到 useLastTxSig(localStorage 历史)
  const [sessionSig, setSessionSig] = useState<string | null>(null);
  const lastSig = useLastTxSig();
  const realSig = sessionSig ?? lastSig;
  const reportHref = realSig ? `/v2/tx/${realSig}` : `/v2/tx/${MOCK_TX_SIG}`;
  const reportLabel = realSig ? '查看你的交易报告 →' : '查看交易报告 demo →';

  return (
    <div className="v2-card v2-token-trade">
      {/* V1 TradeTabs · compact + chromeless · marketOnly 砍内层"市价/限价" tab(MUST NOT DO 第 5 条 · V2 不做 limit)
          chromeless · V2 .v2-card 已提供外 chrome · V1 内 Card 必须砍干净 · 防双 chrome 错位
          onSuccess · swap 上链 confirm 后存 sig · 入口实时切真链接
          自带 Buy/Sell + 滑点 + 优先费 + 防夹 + Phantom 签 */}
      <TradeTabs
        mint={mint}
        compact
        chromeless
        defaultSide={defaultSide}
        marketOnly
        onSuccess={(sig) => {
          setSessionSig(sig);
          setLastTxSig(sig);
        }}
      />

      {/* 真 sig 优先 · 没就 demo · brand-up 强调真链接 */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid var(--border-v2)',
          textAlign: 'center',
        }}
      >
        <Link
          href={reportHref}
          prefetch={false}
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 11,
            color: 'var(--brand-up)',
            textDecoration: 'none',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontWeight: realSig ? 600 : 400,
          }}
        >
          {reportLabel}
        </Link>
      </div>
    </div>
  );
}
