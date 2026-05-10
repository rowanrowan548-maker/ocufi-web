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
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  apiFetch,
  fetchPortfolioHoldings,
  fetchPortfolioSavings,
  fetchPortfolioMevSavings,
  fetchEmptyAccounts,
  fetchPrice,
  type HoldingsResponse,
  type PortfolioSavingsResponse,
  type PortfolioMevSavingsResponse,
  type HoldingItem,
} from '@/lib/api-client';
import { SOL_MINT } from '@/lib/portfolio';
import { useSwapRefresh } from '@/lib/swap-refresh-store';
import { getTransparencyReport, mapReportToView, pickSolDp, type TxViewData } from '@/lib/transparency';
import { useTokenMeta, usePreloadJupiterList } from '@/lib/token-display';
import { SweepAtaModal } from './sweep-ata-modal';

// P3-FE-2 bug 3 · 阈值 $0.01 太严 · 0.001 SOL 小测试单全被折叠
// 降到 $0.0001(基本只过滤 0 余额)· 散户测试 token 也能在主列表看见
const DUST_USD = 0.0001;

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

// P4-FE-1 · 砍 SOL_USD hardcode · 改实时拉
// 任何价格写死都错(SOL 价分钟级波动)· 持仓 USD 必须用实时价
// 优先 holdings.items 中 SOL 的 priceUsd · 没有就 fetchPrice(SOL_MINT) · 拉不到显 "—"

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
  const [dustExpandedRaw, setDustExpanded] = useState(false);
  // P3-FE-8 · swap 后链上 RPC + birdeye sync 延迟 5-30s · banner 显数据在 sync
  const [syncing, setSyncing] = useState(false);
  // P3-FE-9 · 替代 sell 100% reclaim toast · 持仓页主动显眼条
  const [reclaimable, setReclaimable] = useState<{ sol: number; count: number } | null>(null);
  // P3-FE-10 · 交易历史 · 持仓页直接显近 10 笔 · 不让用户跳到 /v2/reports
  const [history, setHistory] = useState<TxViewData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // P4-FE-1 · SOL 实时美元价 · 拉不到就 null · 不糊弄
  const [solUsdPrice, setSolUsdPrice] = useState<number | null>(null);
  // P3-FE-8 · 订阅 swap 完成事件 · BuyForm/SellForm onSuccess → bumpSwap()
  const swapVersion = useSwapRefresh((s) => s.swapVersion);
  const prevSwapVersion = useRef(swapVersion);

  // P3-FE-10 · 预热 Jupiter strict list · 后续 useTokenMeta 同步命中
  usePreloadJupiterList();

  const wallet = publicKey?.toBase58();

  // P3-FE-8 · 主 fetch + swap 后 5s/15s/30s 三次 polling 救场
  useEffect(() => {
    if (!connected || !wallet) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const isSwapTrigger = swapVersion !== prevSwapVersion.current;
    prevSwapVersion.current = swapVersion;

    const doFetch = () => {
      if (cancelled) return Promise.resolve();
      return Promise.all([
        fetchPortfolioHoldings(wallet).catch(() => null),
        fetchPortfolioSavings(wallet).catch(() => null),
        fetchPortfolioMevSavings(wallet).catch(() => null),
      ]).then(([h, s, m]) => {
        if (cancelled) return;
        setHoldings(h);
        setSavings(s);
        setMev(m);
        if (!h && !s) setErr(t('loadFailed'));
      });
    };

    setErr(null);
    if (isSwapTrigger) {
      // swap 完 · 不闪 loading · 显 sync banner · 5s/15s/30s 三次 polling
      setSyncing(true);
      timers.push(setTimeout(() => doFetch(), 5_000));
      timers.push(setTimeout(() => doFetch(), 15_000));
      timers.push(setTimeout(() => {
        doFetch().finally(() => {
          if (!cancelled) setSyncing(false);
        });
      }, 30_000));
    } else {
      // 首次 / wallet 切换 · 正常 loading
      setLoading(true);
      doFetch().finally(() => {
        if (!cancelled) setLoading(false);
      });
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [connected, wallet, swapVersion, t]);

  // P3-FE-9 · 单独检 reclaimable ATA · swap 后也重检
  useEffect(() => {
    if (!connected || !wallet) {
      setReclaimable(null);
      return;
    }
    let cancelled = false;
    fetchEmptyAccounts(wallet)
      .then((r) => {
        if (cancelled) return;
        const list = r.accounts ?? [];
        if (list.length > 0) {
          const sol = list.reduce((s, a) => s + (a.rent_lamports ?? 0), 0) / 1e9;
          setReclaimable({ sol, count: list.length });
        } else {
          setReclaimable(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setReclaimable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, wallet, swapVersion]);

  // P3-FE-10 · 拉近 10 笔交易历史 · GET recent + 并发拉每笔 detail
  useEffect(() => {
    if (!connected || !wallet) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    type RecentResp = { ok: boolean; data: { sig: string; created_at: string }[]; error: string | null };
    apiFetch<RecentResp>(`/transparency/recent?wallet=${encodeURIComponent(wallet)}&limit=10`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
          setHistory([]);
          return;
        }
        const details = await Promise.all(
          res.data.map((it) => getTransparencyReport(it.sig).catch(() => null)),
        );
        if (cancelled) return;
        const views = details
          .filter((r): r is NonNullable<typeof r> => r != null)
          .map(mapReportToView);
        setHistory(views);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, wallet, swapVersion]);

  // P4-FE-1 · 实时 SOL 价格 · 优先 holdings.items SOL · 没有就 fetchPrice(SOL_MINT)
  // 任何 hardcode 数字都错 · SOL 分钟级波动 · 拉不到就 null · UI 显 "—"
  useEffect(() => {
    // 先看 holdings 里有没有 SOL 的 priceUsd
    const solHolding = holdings?.items?.find((i) => i.mint === SOL_MINT);
    if (solHolding?.priceUsd && solHolding.priceUsd > 0) {
      setSolUsdPrice(solHolding.priceUsd);
      return;
    }
    // 没 SOL 持仓 / priceUsd 缺 → 主动拉 /price/<SOL_MINT>(后端 birdeye proxy · 60s cache)
    let cancelled = false;
    fetchPrice(SOL_MINT)
      .then((p) => {
        if (cancelled) return;
        if (p?.price_usd && p.price_usd > 0) setSolUsdPrice(p.price_usd);
        else setSolUsdPrice(null);
      })
      .catch(() => {
        if (cancelled) return;
        setSolUsdPrice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [holdings, swapVersion]);

  if (!connected || !wallet) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '120px 24px' }}>
        {/* P4-FE-4 · 用 v2-card-glow 共享 class · 跟 OgCard hero 同视觉(双 radial brand glow + 渐变 bg) */}
        <div
          className="v2-card-glow"
          style={{
            padding: 56,
            borderRadius: 20,
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

  const totalUsd = holdings?.totalValueUsd ?? 0;
  const items = holdings?.items ?? [];
  const tradeCount = savings?.trade_count ?? 0;
  // P5-FE-18 · 后端 P5-BE-4 已切 transparency_reports 主源 · 直接信单一真源
  const savedSol = (savings?.totals?.saved_sol ?? 0) + (mev?.total_saved_sol ?? 0);
  // P4-FE-1 · solUsdPrice null 时 USD 全 null · UI 显 "—" · 永不糊弄
  const savedUsd = solUsdPrice != null ? savedSol * solUsdPrice : null;
  const feeSavedUsd = solUsdPrice != null ? (savings?.totals?.fee_saved_sol ?? 0) * solUsdPrice : null;
  const mevSavedUsd = solUsdPrice != null ? (mev?.total_saved_sol ?? 0) * solUsdPrice : null;

  // 拆 dust(<$0.01)· P2-HOTFIX-3 #3 · Phantom-style folding · 主列表干净
  const mainItems: HoldingItem[] = items.filter((h) => (h.valueUsd ?? 0) >= DUST_USD);
  const dustItems: HoldingItem[] = items.filter((h) => (h.valueUsd ?? 0) < DUST_USD);
  const dustTotalUsd = dustItems.reduce((s, h) => s + (h.valueUsd ?? 0), 0);

  // P3-FE-4 polish 1 · empty state 条件改成"全新钱包"(tradeCount === 0)
  // 之前 mainItems.length === 0 也显空 → 用户做过 swap 但全 dust 也被当新人 · 死板
  // 现在 tradeCount > 0 但 mainItems 空 → 走正常渲染 + 自动展开 dust + 友好文案
  // 全自动展开 dust:有交易但 mainItems 全 dust 时 dust 默认展开
  const allDust = tradeCount > 0 && mainItems.length === 0 && dustItems.length > 0;
  const dustExpanded = dustExpandedRaw || allDust;
  if (tradeCount === 0) {
    return (
      <>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px' }}>
        {/* P4-FE-4 · 用 v2-card-glow 共享 class · 同视觉锚 */}
        <div
          className="v2-card-glow"
          style={{
            padding: '40px 32px',
            borderRadius: 20,
            textAlign: 'center',
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
              {t('dust.inlineNote', { n: dustItems.length, usd: fmtUsd(dustTotalUsd) })}
            </div>
          )}
        </div>
      </main>
      <SweepAtaModal open={sweepOpen} onClose={() => setSweepOpen(false)} />
      </>
    );
  }

  // mainItems 算 allocations(dust 不参与百分比)
  const mainTotalUsd = mainItems.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  const allocations = mainItems.map((h) => ({
    ...h,
    pct: mainTotalUsd > 0 ? ((h.valueUsd ?? 0) / mainTotalUsd) * 100 : 0,
  }));

  return (
    <main>
      {/* P3-FE-8 · swap 后链上 RPC + birdeye sync 5-30s · 横条提示数据在更新 · 不闪 loading */}
      {syncing && (
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '12px 56px',
            background: 'var(--brand-soft)',
            borderBottom: '1px solid var(--border-brand)',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--brand-up)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
          className="v2-pf-syncing"
        >
          {t('syncing')}
        </div>
      )}
      {/* P3-FE-9 · 替代 sell 100% toast · 持仓页主动显眼条 · 真有可回收时弹 */}
      {reclaimable && !syncing && (
        <div
          className="v2-pf-reclaim-banner"
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '14px 56px',
            background: 'linear-gradient(90deg, var(--brand-soft), transparent)',
            borderBottom: '1px solid var(--border-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 18,
                color: 'var(--brand-up)',
                letterSpacing: '-0.01em',
              }}
            >
              {t('reclaimBanner.headline', { sol: reclaimable.sol.toFixed(4) })}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                fontSize: 11,
                color: 'var(--ink-60)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {t('reclaimBanner.sub', { count: reclaimable.count })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSweepOpen(true)}
            style={{
              flexShrink: 0,
              padding: '10px 20px',
              borderRadius: 999,
              background: 'var(--brand-up)',
              color: 'var(--bg-base)',
              border: 0,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              boxShadow: '0 0 24px rgba(25,251,155,0.28)',
            }}
          >
            {t('reclaimBanner.cta')}
          </button>
        </div>
      )}
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

        {/* 累计省下卡 · brand 玻璃 + 微浮动(P2-HOTFIX-3 #5 视觉锚跟 OG 卡公式齐)
            P4-FE-5 · 套 v2-card-glow class · 跟 hero 视觉同源 */}
        <div
          className="v2-pf-saved v2-card-glow"
          style={{
            marginTop: 36,
            padding: '22px 24px',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: 720,
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
              {fmtSol(savedSol, pickSolDp(savedSol))} SOL
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

        {/* P5-FE-18 · 后端返 source=legacy_no_savings_data 时显诚实注解 · V1 时代交易不计入 V2 累计省钱 */}
        {savings?.source === 'legacy_no_savings_data' && tradeCount > 0 && (
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              color: 'var(--ink-40)',
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              maxWidth: 720,
            }}
          >
            {t('legacy.disclaimer')}
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
            const change = h.priceChange24hPct;
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
                <HoldingTokenCell
                  mint={h.mint}
                  symbol={h.symbol ?? ''}
                  name={h.name ?? ''}
                  fallbackLogo={h.logoURI ?? null}
                />
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
                  {fmtAmount(h.uiAmount, h.decimals)}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: 13, color: 'var(--ink-100)', fontWeight: 500 }}>
                  {fmtUsd(h.valueUsd ?? 0)}
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

          {/* P3-FE-4 polish 1 · 用户做过 swap 但 mainItems 全 dust · 友好提示 + 自动展开 */}
          {allDust && (
            <div
              style={{
                padding: '20px 20px',
                fontSize: 13,
                color: 'var(--ink-60)',
                lineHeight: 1.55,
                borderBottom: '1px solid var(--border-v2)',
                background: 'var(--bg-card-v2)',
              }}
            >
              {t('dust.allDustNote', { n: tradeCount, usd: fmtUsd(dustTotalUsd) })}
              <span style={{ color: 'var(--ink-40)', marginLeft: 6 }}>
                {t('dust.allDustExpand')}
              </span>
            </div>
          )}

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
                    {t('dust.fold', { n: dustItems.length, usd: fmtUsd(dustTotalUsd) })}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-40)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
                  {t('dust.expandHint')}
                </span>
              </button>
              {dustExpanded && (
                <ul style={{ listStyle: 'none', margin: 0, padding: '0 20px 12px' }}>
                  {dustItems.map((h) => (
                    <HoldingDustRow
                      key={h.mint}
                      mint={h.mint}
                      symbol={h.symbol ?? ''}
                      fallbackLogo={h.logoURI ?? null}
                      uiAmount={h.uiAmount}
                      decimals={h.decimals}
                      valueUsd={h.valueUsd ?? 0}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      </section>

      {/* P3-FE-10 · 交易历史 · 持仓页直接显近 10 笔 · 不让用户跳到 /v2/reports */}
      {history.length > 0 && (
        <section
          className="v2-pf-history"
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '12px 56px 40px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-40)',
              marginBottom: 14,
            }}
          >
            {t('history.title', { n: history.length })}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h) => (
              <li key={h.sig}>
                <HistoryRow
                  item={h}
                  sideLabels={{ buy: t('history.buy'), sell: t('history.sell') }}
                  savedLabel={t('history.saved')}
                  spentLabel={t('history.spent')}
                  receivedLabel={t('history.received')}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {historyLoading && history.length === 0 && (
        <section
          className="v2-pf-history"
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '0 56px 24px',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-40)',
          }}
        >
          {t('history.loading')}
        </section>
      )}

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
        {t('sweep.fab')}
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
          className="v2-card-glow"
          style={{
            color: 'var(--brand-up)',
            padding: '14px 24px',
            borderRadius: 14,
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {t('sweep.deskCta')}
          <span style={{ fontSize: 11, color: 'var(--ink-40)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
            {t('sweep.deskHint')}
          </span>
        </button>
      </section>

      <SweepAtaModal open={sweepOpen} onClose={() => setSweepOpen(false)} />
    </main>
  );
}

// P3-FE-12 · 交易历史卡 · 熵减 #F · 单行干瘪 → 卡式 · token logo + side overlay
// 数据映射:
//   buy:  Bought tokenOut.symbol · tokenOut.amount  · 花费 = tokenIn.amount SOL
//   sell: Sold   tokenIn.symbol  · tokenIn.amount   · 换得 = tokenOut.amount SOL
// click 整行跳 /v2/tx/<sig>
function HistoryRow({
  item,
  sideLabels,
  savedLabel,
  spentLabel,
  receivedLabel,
}: {
  item: TxViewData;
  sideLabels: { buy: string; sell: string };
  savedLabel: string;
  spentLabel: string;
  receivedLabel: string;
}) {
  const sideLabel = item.side === 'buy' ? sideLabels.buy : sideLabels.sell;
  // 用户视角 · 看的是 swap 的"主角 token"(buy 是拿到的 / sell 是卖掉的)
  const focus = item.side === 'buy' ? item.tokenOut : item.tokenIn;
  // counter side(SOL/USDC 那侧)· 显花费 / 换得
  const counter = item.side === 'buy' ? item.tokenIn : item.tokenOut;
  const meta = useTokenMeta(focus.mint, focus.symbol);
  const dateShort = item.timestamp.replace(' UTC', '');
  const sideIsBuy = item.side === 'buy';
  return (
    <Link
      href={`/v2/tx/${item.sig}`}
      prefetch={false}
      className="v2-card-glow"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0,1fr) auto',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        borderRadius: 14,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* 左 · token logo + side 角标(↑买 / ↓卖) · P3-FE-13 · img onError 字母圆 fallback */}
      <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
        <TokenAvatar logoURI={meta.logoURI} symbol={meta.symbol} size={36} />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: sideIsBuy ? 'var(--brand-up)' : 'var(--ink-40)',
            color: '#0b0d12',
            display: 'grid',
            placeItems: 'center',
            fontSize: 10,
            fontWeight: 700,
            border: '2px solid var(--bg-card-v2)',
          }}
        >
          {sideIsBuy ? '↑' : '↓'}
        </span>
      </div>

      {/* 中 · symbol + amount + date */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 14, color: 'var(--ink-100)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sideLabel} {meta.symbol} ·{' '}
          <span style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontWeight: 500, color: 'var(--ink-80)' }}>
            {focus.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })}
          </span>
        </span>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 11,
            color: 'var(--ink-40)',
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {dateShort}
        </span>
      </div>

      {/* 右 · saved + counter amount */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {item.savedSol > 0 && (
          <span
            style={{
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              fontSize: 13,
              color: 'var(--brand-up)',
              fontWeight: 600,
            }}
          >
            ↗ {savedLabel} {item.savedSol.toFixed(item.solDp)} SOL
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 11,
            color: 'var(--ink-40)',
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {sideIsBuy ? spentLabel : receivedLabel} {counter.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} {counter.symbol}
        </span>
      </div>
    </Link>
  );
}

// P3-FE-13 · token 头像 · logoURI 有显 img · 没/404 时显字母圆 fallback
function TokenAvatar({ logoURI, symbol, size }: { logoURI: string | null; symbol: string; size: number }) {
  const [errored, setErrored] = useState(false);
  const showImg = !!logoURI && !errored;
  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoURI as string}
        alt={symbol}
        width={size}
        height={size}
        style={{ borderRadius: '50%', display: 'block' }}
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #00ffa3, #03e1ff)',
        display: 'grid',
        placeItems: 'center',
        color: '#0b0d12',
        fontWeight: 700,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {(symbol || '?').charAt(0).toUpperCase()}
    </div>
  );
}

// P4-FE-3 · 持仓主行 token cell · 走 useTokenMeta · 解决 SOL 无头像 + 跨页头像不一致
// 后端 holdings.logoURI 来自 birdeye /wallet/portfolio · SOL 经常 null · 跟 /v3/token/meta-multiple 也对不上
// 改:统一走 useTokenMeta(KNOWN_TOKENS sync 静态 logo 兜底 + 后端 /price/<mint> 同步升级)
function HoldingTokenCell({
  mint,
  symbol,
  name,
  fallbackLogo,
}: {
  mint: string;
  symbol: string;
  name: string;
  fallbackLogo: string | null;
}) {
  const meta = useTokenMeta(mint, symbol);
  const logo = meta.logoURI ?? fallbackLogo ?? null;
  const displaySymbol = meta.symbol || symbol || '—';
  const displayName = meta.name || name || shortAddr(mint);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <TokenAvatar logoURI={logo} symbol={displaySymbol} size={36} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>{displaySymbol}</div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-40)',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </div>
      </div>
    </div>
  );
}

// P4-FE-3 · dust 行 · 同源 useTokenMeta
function HoldingDustRow({
  mint,
  symbol,
  fallbackLogo,
  uiAmount,
  decimals,
  valueUsd,
}: {
  mint: string;
  symbol: string;
  fallbackLogo: string | null;
  uiAmount: number;
  decimals: number;
  valueUsd: number;
}) {
  const meta = useTokenMeta(mint, symbol);
  const logo = meta.logoURI ?? fallbackLogo ?? null;
  const displaySymbol = meta.symbol || symbol || '—';
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        fontSize: 12,
        color: 'var(--ink-60)',
      }}
    >
      <TokenAvatar logoURI={logo} symbol={displaySymbol} size={20} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displaySymbol} · {fmtAmount(uiAmount, decimals)}
      </span>
      <span style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
        {fmtUsd(valueUsd, 4)}
      </span>
    </li>
  );
}
