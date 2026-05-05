'use client';

/**
 * V2 Portfolio · /v2/portfolio · 客户端 + wallet 连接后并发取 3 endpoint
 *
 * 数据源(全 V1 已 ship):
 *   - fetchPortfolioHoldings(wallet)
 *   - fetchPortfolioSavings(wallet)
 *   - fetchPortfolioMevSavings(wallet)
 *
 * 视觉对齐 mockup `.coordination/V2/MOCKUPS/v2-overall.html` `/portfolio` 段:
 *   - eyebrow(Total balance / 短钱包 拆 2 行 mobile)
 *   - Geist 96px tnum 总值 + delta(brand-up 色)
 *   - 累计省下卡(Newsreader italic 0.234 SOL)
 *   - 6 列 token 表(桌面)/ 2 行布局(mobile)
 *   - ATA 1 行 banner + 一键清扫 CTA(暂 placeholder · 复用 V1 reclaim 留 P3)
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  fetchPortfolioHoldings,
  fetchPortfolioSavings,
  fetchPortfolioMevSavings,
  type HoldingsResponse,
  type PortfolioSavingsResponse,
  type PortfolioMevSavingsResponse,
  type HoldingItem,
} from '@/lib/api-client';
import { SweepAtaModal } from './sweep-ata-modal';

const DUST_USD = 0.01; // < $0.01 折叠成"零碎币" 一行

function fmtUsd(n: number | null | undefined, max = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: max, minimumFractionDigits: max });
}
function fmtSol(n: number | null | undefined, dp = 4): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(dp);
}
function fmtAmount(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(decimals > 4 ? 4 : decimals);
  return n.toFixed(6);
}
function shortAddr(a: string): string {
  return a.length <= 8 ? a : `${a.slice(0, 4)}...${a.slice(-4)}`;
}

const SOL_USD = 200; // fallback price for SOL → USD when savings comes only in SOL

export function PortfolioView() {
  const t = useTranslations('v2.portfolio');
  const { connected, publicKey } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [holdings, setHoldings] = useState<HoldingsResponse | null>(null);
  const [savings, setSavings] = useState<PortfolioSavingsResponse | null>(null);
  const [mev, setMev] = useState<PortfolioMevSavingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sweepOpen, setSweepOpen] = useState(false);
  const [dustExpanded, setDustExpanded] = useState(false);

  const wallet = publicKey?.toBase58();

  useEffect(() => {
    if (!connected || !wallet) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    Promise.all([
      fetchPortfolioHoldings(wallet).catch(() => null),
      fetchPortfolioSavings(wallet).catch(() => null),
      fetchPortfolioMevSavings(wallet).catch(() => null),
    ]).then(([h, s, m]) => {
      if (cancelled) return;
      setHoldings(h);
      setSavings(s);
      setMev(m);
      setLoading(false);
      if (!h && !s) setErr(t('loadFailed'));
    });
    return () => {
      cancelled = true;
    };
  }, [connected, wallet, t]);

  if (!connected || !wallet) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '120px 24px' }}>
        <div
          style={{
            padding: 56,
            background: 'var(--bg-card-v2)',
            border: '1px solid var(--border-brand-soft)',
            borderRadius: 20,
            boxShadow: 'var(--shadow-glow-v2)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color: 'var(--brand-up)', marginBottom: 16 }}>
            {t('connect.title')}
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-80)', marginBottom: 32 }}>
            {t('connect.sub')}
          </div>
          <button
            type="button"
            onClick={() => openWalletModal(true)}
            style={{
              background: 'var(--brand-up)',
              color: 'var(--bg-base)',
              padding: '14px 32px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              border: 0,
              fontFamily: 'inherit',
              boxShadow: '0 0 30px rgba(25,251,155,0.18)',
              letterSpacing: '-0.01em',
            }}
          >
            {t('connect.cta')}
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '80px 56px', textAlign: 'center', color: 'var(--ink-60)' }}>
        {t('loading')}
      </main>
    );
  }

  if (err) {
    return (
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '80px 56px', textAlign: 'center', color: 'var(--warn, #FF6B6B)' }}>
        {err}
      </main>
    );
  }

  const totalUsd = holdings?.total_usd ?? 0;
  const items = holdings?.items ?? [];
  const tradeCount = savings?.trade_count ?? 0;
  const savedSol = (savings?.totals?.saved_sol ?? 0) + (mev?.total_saved_sol ?? 0);
  const savedUsd = savedSol * SOL_USD;
  const feeSavedUsd = (savings?.totals?.fee_saved_sol ?? 0) * SOL_USD;
  const mevSavedUsd = (mev?.total_saved_sol ?? 0) * SOL_USD;

  // 拆 dust(<$0.01)· P2-HOTFIX-3 #3 · Phantom-style folding · 主列表干净
  const mainItems: HoldingItem[] = items.filter((h) => (h.value_usd ?? 0) >= DUST_USD);
  const dustItems: HoldingItem[] = items.filter((h) => (h.value_usd ?? 0) < DUST_USD);
  const dustTotalUsd = dustItems.reduce((s, h) => s + (h.value_usd ?? 0), 0);

  // empty state · "0 个有价值 token"(items 全 dust 或全空)· P2-HOTFIX-3 #3 友好文案 + CTA
  // 之前 items.length === 0 才显;现在 mainItems.length === 0 也显(因为只有 dust 时也算"没有价值 token")
  if (mainItems.length === 0) {
    return (
      <>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px' }}>
        <div
          style={{
            padding: '40px 32px',
            background: 'var(--bg-card-v2)',
            border: '1px solid var(--border-brand-soft)',
            borderRadius: 20,
            textAlign: 'center',
            boxShadow: 'var(--shadow-glow-v2)',
            animation: 'v2-float-home 4s ease-in-out infinite',
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(24px, 5vw, 32px)', color: 'var(--brand-up)', marginBottom: 14, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {t('empty.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-40)', marginBottom: 10, fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
            {shortAddr(wallet)} · {tradeCount} trades
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-60)', marginBottom: 22, lineHeight: 1.5, padding: '0 8px' }}>
            {t('empty.sub')}
          </div>
          <Link
            href="/v2"
            prefetch={false}
            style={{
              display: 'inline-block',
              background: 'var(--brand-up)',
              color: 'var(--bg-base)',
              padding: '14px 32px',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 0 30px rgba(25,251,155,0.28)',
              letterSpacing: '-0.01em',
            }}
          >
            {t('empty.cta')}
          </Link>
          {dustItems.length > 0 && (
            <div style={{ marginTop: 22, fontSize: 11, color: 'var(--ink-40)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
              · 钱包还有 {dustItems.length} 个零碎币 · 总值 {fmtUsd(dustTotalUsd)} ·
            </div>
          )}
        </div>
      </main>
      <SweepAtaModal open={sweepOpen} onClose={() => setSweepOpen(false)} />
      </>
    );
  }

  // mainItems 算 allocations(dust 不参与百分比)
  const mainTotalUsd = mainItems.reduce((s, h) => s + (h.value_usd ?? 0), 0);
  const allocations = mainItems.map((h) => ({
    ...h,
    pct: mainTotalUsd > 0 ? ((h.value_usd ?? 0) / mainTotalUsd) * 100 : 0,
  }));

  return (
    <main>
      {/* hero · 大字总值 + 累计省下卡 */}
      <section
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '80px 56px 48px',
        }}
        className="v2-portfolio-hero"
      >
        <div
          className="v2-pf-eyebrow"
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-40)',
            marginBottom: 14,
          }}
        >
          {t('hero.totalLabel')} · {shortAddr(wallet)}
        </div>
        <div
          className="v2-pf-total"
          style={{
            fontFamily: 'var(--font-geist), sans-serif',
            fontSize: 'clamp(64px, 8vw, 96px)',
            fontWeight: 500,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            marginBottom: 16,
            color: 'var(--ink-100)',
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {fmtUsd(totalUsd)}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 16,
            color: 'var(--ink-60)',
          }}
        >
          {tradeCount} trades · holdings = {fmtUsd(totalUsd)}
        </div>

        {/* 累计省下卡 · brand 玻璃 + 微浮动(P2-HOTFIX-3 #5 视觉锚跟 OG 卡公式齐) */}
        <div
          className="v2-pf-saved"
          style={{
            marginTop: 36,
            padding: '22px 24px',
            background: 'var(--bg-card-v2)',
            border: '1px solid var(--border-brand-soft)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: 720,
            boxShadow: 'var(--shadow-glow-v2)',
            animation: 'v2-float 5s ease-in-out infinite',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-40)',
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {t('hero.savedLabel')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 32,
                color: 'var(--brand-up)',
                letterSpacing: '-0.02em',
              }}
            >
              {fmtSol(savedSol, 3)} SOL
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-60)',
              textAlign: 'right',
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            }}
          >
            ≈ {fmtUsd(savedUsd)} · {tradeCount} trades
            <br />
            <span style={{ color: 'var(--brand-up)' }}>
              fee {fmtUsd(feeSavedUsd)} · MEV {fmtUsd(mevSavedUsd)}
            </span>
          </div>
        </div>

        {/* P2-HOTFIX-3 #3 · 累计省下=0 SOL 时加诚实注解 · 老数据 sol_amount 字段不全 */}
        {savedSol === 0 && tradeCount > 0 && (
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              color: 'var(--ink-40)',
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              maxWidth: 720,
            }}
          >
            ⓘ 老交易 sol_amount 字段还在补 · 新交易会真实累计 · 不糊弄
          </div>
        )}
      </section>

      {/* token list · 桌面 6 列 / mobile 2 行 */}
      <section
        className="v2-pf-list"
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '0 56px 40px',
        }}
      >
        <>
          <div
            className="v2-pf-list-head"
            style={{
              display: 'grid',
              gridTemplateColumns: '240px 1fr 120px 140px 100px 84px',
              gap: 16,
              alignItems: 'center',
              padding: '10px 20px',
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-40)',
              borderBottom: '1px solid var(--border-v2)',
            }}
          >
            <span>{t('table.token')}</span>
            <span>{t('table.allocation')}</span>
            <span style={{ textAlign: 'right' }}>{t('table.holdings')}</span>
            <span style={{ textAlign: 'right' }}>{t('table.value')}</span>
            <span style={{ textAlign: 'right' }}>{t('table.change')}</span>
            <span style={{ textAlign: 'right' }}>{t('table.action')}</span>
          </div>
          {allocations.map((h) => {
            const change = h.price_change_24h_pct;
            const changeUp = change != null && change >= 0;
            const sellHref = `/v2/token/${h.mint}?action=sell`;
            return (
              <Link
                key={h.mint}
                href={sellHref}
                prefetch={false}
                className="v2-pf-list-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '240px 1fr 120px 140px 100px 84px',
                  gap: 16,
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-v2)',
                  textDecoration: 'none',
                  color: 'var(--ink-100)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  {h.logo_uri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.logo_uri} alt="" width={36} height={36} style={{ borderRadius: '50%', flexShrink: 0 }} />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00ffa3, #03e1ff)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {(h.symbol || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>{h.symbol || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-40)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.name || shortAddr(h.mint)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, h.pct)}%`,
                        background: h.pct > 50 ? 'var(--brand-up)' : 'var(--ink-40)',
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: 11, color: 'var(--ink-60)' }}>
                    {h.pct.toFixed(0)}%
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: 13 }}>
                  {fmtAmount(h.amount, h.decimals)}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: 13, color: 'var(--ink-100)', fontWeight: 500 }}>
                  {fmtUsd(h.value_usd ?? 0)}
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                    fontSize: 13,
                    color: change == null ? 'var(--ink-40)' : changeUp ? 'var(--brand-up)' : 'var(--warn, #FF6B6B)',
                  }}
                >
                  {change == null ? '—' : `${changeUp ? '+' : ''}${change.toFixed(1)}%`}
                </div>
                {/* Sell 按钮 · 桌面显 · mobile 整行 click 也跳同 URL · 用 .v2-pf-sell 媒查 hide */}
                <div
                  className="v2-pf-sell"
                  style={{
                    textAlign: 'right',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '6px 14px',
                      borderRadius: 999,
                      border: '1px solid var(--brand-up)',
                      color: 'var(--brand-up)',
                      fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      background: 'var(--bg-card-v2)',
                      boxShadow: '0 0 12px rgba(25,251,155,0.12)',
                    }}
                  >
                    {t('table.sell')}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* P2-HOTFIX-3 #3 · dust 折叠行 · "零碎币 · 共 N · $X" · click 展开列表(同 Phantom) */}
          {dustItems.length > 0 && (
            <div className="v2-pf-dust-wrap" style={{ borderBottom: '1px solid var(--border-v2)' }}>
              <button
                type="button"
                onClick={() => setDustExpanded((v) => !v)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--ink-60)',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-40)' }}>{dustExpanded ? '▼' : '▶'}</span>
                  <span style={{ fontSize: 13 }}>
                    零碎币 · 共 {dustItems.length} 个 · 总值 {fmtUsd(dustTotalUsd)}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-40)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
                  &lt; $0.01 · click 展开
                </span>
              </button>
              {dustExpanded && (
                <ul style={{ listStyle: 'none', margin: 0, padding: '0 20px 12px' }}>
                  {dustItems.map((h) => (
                    <li
                      key={h.mint}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 0',
                        fontSize: 12,
                        color: 'var(--ink-60)',
                      }}
                    >
                      {h.logo_uri ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.logo_uri} alt="" width={20} height={20} style={{ borderRadius: '50%', flexShrink: 0 }} />
                      ) : (
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #00ffa3, #03e1ff)',
                            display: 'inline-grid',
                            placeItems: 'center',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 9,
                            flexShrink: 0,
                          }}
                        >
                          {(h.symbol || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.symbol || '—'} · {fmtAmount(h.amount, h.decimals)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
                        {fmtUsd(h.value_usd ?? 0, 4)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      </section>

      {/* sticky 清扫 ATA 按钮 · mobile only · bottom-tab-bar 之上 · 用户随时可点(P2-HOTFIX-3 #5) */}
      <button
        type="button"
        className="v2-pf-sweep-fab"
        onClick={() => setSweepOpen(true)}
        style={{
          display: 'none',
          position: 'fixed',
          left: 16,
          right: 16,
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
          height: 52,
          background: 'var(--brand-up)',
          color: 'var(--bg-base)',
          border: 0,
          borderRadius: 14,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          cursor: 'pointer',
          boxShadow: '0 8px 28px rgba(25,251,155,0.32), 0 0 24px rgba(25,251,155,0.18)',
          zIndex: 80,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        ✨ 清扫 ATA · 回收 SOL
      </button>

      {/* 桌面 sweep CTA · 在列表后挂一行(mobile 用 sticky FAB · 这里 hide via .v2-pf-sweep-desk) */}
      <section
        className="v2-pf-sweep-desk"
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '8px 56px 60px',
        }}
      >
        <button
          type="button"
          onClick={() => setSweepOpen(true)}
          style={{
            background: 'var(--bg-card-v2)',
            border: '1px solid var(--border-brand-soft)',
            color: 'var(--brand-up)',
            padding: '14px 24px',
            borderRadius: 14,
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-card-v2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          ✨ 清扫 ATA · 回收闲置 SOL
          <span style={{ fontSize: 11, color: 'var(--ink-40)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
            (in-page · 不跳页)
          </span>
        </button>
      </section>

      <SweepAtaModal open={sweepOpen} onClose={() => setSweepOpen(false)} />
    </main>
  );
}
