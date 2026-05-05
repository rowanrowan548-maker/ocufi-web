/**
 * V2 Token Head · logo + name + addr + price + 24h + MC/LIQ/VOL
 *
 * 桌面:横排 left(logo+name+addr) / right(price+change + stats)
 * mobile:column 堆 + price/change 一行 + 3 列 stats grid(border-top 分割)
 */
import type { TokenDetail } from '@/lib/token-info';

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  if (Math.abs(n) < 0.000001) return `$${n.toExponential(2)}`;
  return `$${n.toFixed(6)}`;
}

function fmtChange(n: number | null | undefined): { text: string; up: boolean } | null {
  if (n == null || !Number.isFinite(n)) return null;
  const up = n >= 0;
  return { text: `${up ? '+' : ''}${n.toFixed(2)}%`, up };
}

function shortAddr(a: string): string {
  return a.length <= 8 ? a : `${a.slice(0, 4)}...${a.slice(-4)}`;
}

export function TokenHead({ detail }: { detail: TokenDetail }) {
  const change = fmtChange(detail.priceChange24h ?? null);
  const initial = (detail.symbol || detail.mint).charAt(0).toUpperCase();

  return (
    <div
      className="v2-card v2-token-head"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {detail.logoUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.logoUri}
            alt=""
            width={52}
            height={52}
            style={{ borderRadius: '50%', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#fff',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )}
        <div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.025em',
            }}
          >
            ${detail.symbol || 'UNKNOWN'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              fontSize: 12,
              color: 'var(--ink-40)',
              marginTop: 2,
            }}
          >
            {shortAddr(detail.mint)}
          </div>
        </div>
      </div>

      <div className="v2-token-prices" style={{ textAlign: 'right' }}>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              fontSize: 30,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {fmtUsd(detail.priceUsd)}
          </div>
          {change && (
            <div
              style={{
                color: change.up ? 'var(--brand-up)' : 'var(--warn, #FF6B6B)',
                fontSize: 14,
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                marginTop: 4,
              }}
            >
              {change.text} · 24h
            </div>
          )}
        </div>
        {/* P2-MOBILE-OVERHAUL #8 · 三栏 stats · 桌面 inline 横排 / mobile grid-3 stack(label 上 value 下) */}
        <div
          className="v2-token-stats"
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 14,
            fontSize: 12,
            color: 'var(--ink-60)',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          }}
        >
          <span>
            <span className="v2-stat-label" style={{ color: 'var(--ink-40)', fontSize: 11 }}>MC</span>
            <span className="v2-stat-value" style={{ color: 'var(--ink-80)', marginLeft: 6, fontSize: 14, fontFeatureSettings: '"tnum" 1' }}>{fmtUsd(detail.marketCap)}</span>
          </span>
          <span>
            <span className="v2-stat-label" style={{ color: 'var(--ink-40)', fontSize: 11 }}>LIQ</span>
            <span className="v2-stat-value" style={{ color: 'var(--ink-80)', marginLeft: 6, fontSize: 14, fontFeatureSettings: '"tnum" 1' }}>{fmtUsd(detail.liquidityUsd)}</span>
          </span>
          <span>
            <span className="v2-stat-label" style={{ color: 'var(--ink-40)', fontSize: 11 }}>VOL 24h</span>
            <span className="v2-stat-value" style={{ color: 'var(--ink-80)', marginLeft: 6, fontSize: 14, fontFeatureSettings: '"tnum" 1' }}>{fmtUsd(detail.volume24h ?? null)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
