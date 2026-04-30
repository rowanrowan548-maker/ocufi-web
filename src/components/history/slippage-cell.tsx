'use client';

/**
 * T-FE-SLIPPAGE-COLUMN / T-FE-SLIPPAGE-BUY · /history 真滑点列单元格
 *
 * 数据源:loadSwapQuote(signature) 从 localStorage 读 ⛓️ 落地的 Jupiter quote
 *
 * V1.0 仅 sell(output = SOL · 不需查 token decimals)
 * V1.1 buy 行扩展 · 用 quote.quoteOutDecimals 转 UI 单位 · 跟 r.tokenAmount 比
 *
 * 渲染规则:
 *   < 0     → '+X.XX%' 绿色(套利获益 · 罕见但好看)
 *   0-50    → 'X.XX%'  浅绿(< 0.5%)
 *   50-200  → 'X.XX%'  灰色(0.5-2%)
 *   > 200   → 'X.XX%'  红色(> 2%)
 *   null    → '—'(无 quote / 转入 / 数据不全 / 旧 v1 条目)
 */
import { useMemo } from 'react';
import { computeRealizedSlippageBps } from '@/lib/slippage';
import { loadSwapQuote } from '@/lib/swap-quote-storage';

interface Props {
  signature: string;
  type: string | null | undefined;
  solAmount: number;
  tokenAmount: number;
}

export function SlippageCell({ signature, type, solAmount, tokenAmount }: Props) {
  // localStorage 读 · 同 sig 不变 · useMemo 缓存
  const bps = useMemo(() => {
    if (type !== 'sell' && type !== 'buy') return null;
    const quote = loadSwapQuote(signature);
    if (!quote) return null;
    return computeRealizedSlippageBps({
      side: quote.side,
      outputMint: quote.outputMint,
      quoteOutAmount: quote.quoteOutAmount,
      actualSolReceived: solAmount,
      actualTokenReceived: tokenAmount,
      quoteOutDecimals: quote.quoteOutDecimals,
    });
  }, [signature, type, solAmount, tokenAmount]);

  if (bps === null) return <span data-testid="slippage-empty">—</span>;

  const pct = bps / 100;
  const isWin = bps < 0;
  const tone =
    isWin
      ? 'text-[var(--brand-up)]'
      : bps < 50
        ? 'text-[var(--brand-up)]/70'
        : bps <= 200
          ? 'text-muted-foreground'
          : 'text-[var(--brand-down)]';
  const sign = isWin ? '+' : '';
  const absPct = Math.abs(pct);
  const display = `${sign}${absPct.toFixed(2)}%`;

  return (
    <span
      data-testid="slippage-realized"
      data-bps={Math.round(bps).toString()}
      className={tone}
    >
      {display}
    </span>
  );
}
