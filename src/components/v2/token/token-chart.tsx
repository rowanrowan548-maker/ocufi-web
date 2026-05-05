'use client';

/**
 * V2 Token Chart · GT iframe wrapper
 * client · 用 V1 fetchTokenInfo 解析 mint → topPoolAddress · 渲染 GeckoTerminal iframe
 *
 * 桌面 360px / mobile 200px(globals 媒查降高)
 */
import { useEffect, useState } from 'react';
import { fetchTokenInfo } from '@/lib/portfolio';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

type Props = { mint: string; symbol: string };

export function TokenChart({ mint, symbol }: Props) {
  const [pool, setPool] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (mint === SOL_MINT) {
      setPool(null);
      return;
    }
    let cancelled = false;
    fetchTokenInfo(mint)
      .then((info) => {
        if (!cancelled) setPool(info?.topPoolAddress ?? null);
      })
      .catch(() => {
        if (!cancelled) setPool(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  const iframeSrc = pool
    ? `https://www.geckoterminal.com/solana/pools/${pool}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price`
    : null;

  return (
    <div
      className="v2-token-chart"
      style={{
        height: 360,
        background: 'var(--bg-card-v2)',
        border: '1px solid var(--border-v2)',
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card-v2)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 11,
          color: 'var(--ink-40)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          zIndex: 2,
        }}
      >
        PRICE · {symbol}
      </span>
      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          title={`${symbol} chart`}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            colorScheme: 'normal',
          }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-40)',
            letterSpacing: '0.08em',
          }}
        >
          {pool === undefined ? 'CHART · 加载中...' : 'CHART · 暂无 LP 池'}
        </div>
      )}
    </div>
  );
}
