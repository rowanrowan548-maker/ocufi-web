/**
 * V2 Home Recents · "最近"标签 + N 个 token chip
 * RSC · server fetch /markets/trending('24h', 6) · 失败 graceful empty(不阻塞首页)
 *
 * V2 路径全跳 /v2/token/<mint>
 */
import { fetchMarketsTrending, type MarketItem } from '@/lib/api-client';
import { ChipToken } from '@/components/v2/shared/chip-token';
import { getTranslations } from 'next-intl/server';

function fmtPrice(p: number | null): string | undefined {
  if (p == null || !Number.isFinite(p)) return undefined;
  if (p === 0) return '$0';
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.01) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  if (p < 1000) return `$${p.toFixed(2)}`;
  return `$${(p / 1000).toFixed(1)}K`;
}

export async function HomeRecents() {
  const t = await getTranslations('v2.home');
  let items: MarketItem[] = [];
  try {
    items = await fetchMarketsTrending('24h', 8);
  } catch {
    // graceful · 不渲染 chip 区
    return null;
  }

  const top = items.slice(0, 5);
  const more = items.length - top.length;

  if (top.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        maxWidth: 580,
      }}
      className="v2-home-recents"
    >
      <span
        style={{
          fontSize: 14,
          color: 'var(--brand-up)',
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          marginRight: 8,
          letterSpacing: '0.04em',
        }}
      >
        {t('recentsLabel')}
      </span>
      {top.map((m) => (
        <ChipToken
          key={m.mint}
          symbol={m.symbol || m.mint.slice(0, 4).toUpperCase()}
          price={fmtPrice(m.priceUsd)}
          href={`/v2/token/${m.mint}`}
          iconImg={m.logo || undefined}
        />
      ))}
      {more > 0 && (
        <span
          style={{
            padding: '8px 16px',
            color: 'var(--ink-40)',
            fontSize: 13,
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          }}
        >
          +{more}
        </span>
      )}
    </div>
  );
}
