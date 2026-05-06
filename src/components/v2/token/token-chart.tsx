'use client';

/**
 * V2 Token Chart · GT iframe wrapper
 * client · 用 V1 fetchTokenInfo 解析 mint → topPoolAddress · 渲染 GeckoTerminal iframe
 *
 * 桌面 360px / mobile 280px(globals 媒查降高)
 *
 * P2-HOTFIX-4 #1 · 砍掉自家 PRICE overlay 标签 — 跟 GT iframe 自带头(Bonk/USD · 15 · Orca |
 * GeckoTerminal.com · O/H/L/C · Volume SMA)叠成乱字 · symbol 已在 TokenHead 显过 · 不重复
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchTokenInfo } from '@/lib/portfolio';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

type Props = { mint: string; symbol: string };

export function TokenChart({ mint, symbol }: Props) {
  const t = useTranslations('v2.token.chart');
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
        position: 'relative',
      }}
    >
      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          title={`${symbol} chart`}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            colorScheme: 'normal',
            display: 'block',
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
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          {pool === undefined ? t('loading', { symbol }) : t('noPool', { symbol })}
        </div>
      )}
    </div>
  );
}
