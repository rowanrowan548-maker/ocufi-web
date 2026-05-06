'use client';

/**
 * V2 TX View · /v2/tx/[sig]
 *
 * P3-FE-1:接真数据(SPEC §4.2 字段映射)· demo sig 走 mock
 * P3-FE-7:i18n 完整(zh-CN / en-US)+ 3 分享按钮真接 click
 *
 * P2-MOBILE-OVERHAUL polish 保留:
 *   - meta 拆 2 独立行(back/share / date · UTC / Solana · Slot)避 320 粘连
 *   - hero subText 拆 2 行 · 防夹保护 ✓ brand-up 强调
 *   - OG card url + saved 拆 2 行(媒查)避 320 行尾错位
 *   - 工程师视角 ▶ 默认折叠
 *   - 3 分享按钮 column 列 + w-full + h-12 等宽等高
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { OgCard } from '@/components/v2/shared/og-card';
import { getTransparencyReport, mapReportToView, type TxViewData } from '@/lib/transparency';
import { useTokenMeta, usePreloadJupiterList } from '@/lib/token-display';

// Phase 2 · mock 数据(BONK 0.5 SOL → 1.23M)· demo sig 用
const MOCK: TxViewData = {
  sig: '5fXq8yAbcDEFghijklmn1234567890ABCdefghi',
  sigShort: '5fXq8y...defghi',
  wallet: '7w4S...g4wM',
  timestamp: '2026-05-08 · 14:23 UTC',
  slot: 287_432_118,
  savedSol: 0.0045,
  savedUsd: 0.9,
  side: 'buy',
  tokenIn: { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', amount: 0.5, decimals: 9 },
  tokenOut: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', amount: 1_234_567, decimals: 5 },
  tokenAmount: 1_234_567,
  tokenSymbol: 'BONK',
  tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  notionalSol: 0.5,
  vsCompetitorSol: 0.5045,
  solDp: 4, // savedSol 0.0045 >= 0.0001 → 4 dp
  slippagePct: 0.32,
  slippageTolerancePct: 1,
  gasSol: 0.000054,
  gasUsd: 0.011,
  feeSol: 0.0005,
  feePct: 0.1,
  competitorFeePct: 1,
  routeStr: 'Jupiter v6',
  finalPriceUsd: 0.000121,
  priceImpactPct: 0,
  mevProtected: true,
  mevBundleId: 'bundle_1A2b3C',
  jupiterRouteSteps: null,
};

function fmtNum(n: number, dp = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

type Props = {
  sig: string;
  data?: TxViewData;
  demo?: boolean;
};

export function TxView({ sig, data, demo }: Props) {
  const t = useTranslations('v2.tx');
  usePreloadJupiterList();
  // 优先级:demo → MOCK + sigShort 替换 / data → 真 / fallback → MOCK
  const d: TxViewData = data
    ?? (demo
      ? { ...MOCK, sig, sigShort: sig.length >= 12 ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : MOCK.sigShort }
      : MOCK);
  const [engineerOpen, setEngineerOpen] = useState(false);
  // P3-FE-10 · token 真 symbol+logo · 救场链上 fallback "DezX"
  const tokenMeta = useTokenMeta(d.tokenMint, d.tokenSymbol);

  // P2-MOBILE-OVERHAUL #4 · subText 拆 2 行 · 第 2 行 brand-up 强调 ✓
  // P3-FE-4 polish 2 · solDp 跟 savedSol 量级匹配 · 防 toFixed(4) 把 0.000045 截成 0.0000 误导
  const tokenAmountStr = d.tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 4 });
  const sideVerb = d.side === 'buy' ? t('buyVerb') : t('sellVerb');
  const flowVerb = d.side === 'buy' ? t('spendVerb') : t('receiveVerb');
  // P3-FE-13 · token logo+symbol 走 OgCard tokenLogo/tokenSymbol prop · 不再 inline 在 subText
  // subLine1 只显数量+方向(symbol 在 OgCard 单独 row 渲染)
  const heroSubLine1 = `${sideVerb} ${tokenAmountStr} · ${flowVerb} ${fmtNum(d.notionalSol, d.solDp)} SOL`;
  // P3-FE-4 polish 2b · 防夹保护友好显:true → ✓ brand 绿 / false → 普通广播 中性灰 / null → 不显
  const mevText = d.mevProtected
    ? <span style={{ color: 'var(--brand-up)' }}>{t('mevProtected')}</span>
    : <span style={{ color: 'var(--ink-40)' }} title={t('mevPlainTooltip')}>{t('mevPlain')}</span>;
  const heroSubLine2 = (
    <>
      {t('vsBullX', { amount: fmtNum(d.vsCompetitorSol, d.solDp) })} · {mevText}
    </>
  );

  // P3-FE-4 polish 2a · savedSol === 0 时替代大字 · 不显误导的 "0.0000"
  const heroSaveText = d.savedSol === 0
    ? t('noFeeBaseline')
    : `${t('savedPrefix')} ${fmtNum(d.savedSol, d.solDp)} ${t('savedSuffix')}`;

  const slippageDisplay = d.slippagePct == null ? '—' : t('card.slippageOk', { pct: fmtNum(d.slippagePct, 2) });
  const slippageSub = t('card.slippageTolerance', { pct: fmtNum(d.slippageTolerancePct, 0) });
  const gasUsdDisplay = d.gasUsd == null ? '—' : t('card.gasUsd', { usd: fmtNum(d.gasUsd, 3) });
  const finalPriceDisplay = d.finalPriceUsd == null ? '—' : `$${fmtNum(d.finalPriceUsd, 6)}`;
  // P3-FE-4 polish 2b · "无防夹"→"普通广播" 跟 hero subLine2 文案一致 · 不抢眼
  const mevDetail = d.mevProtected
    ? (d.mevBundleId ? t('mevDetail.bundle') : t('mevDetail.sender'))
    : t('mevDetail.plain');

  // P3-FE-7 / P4-FE-2 · 分享 · deeplink 优先 · app 装了直开 · 没装 fallback web
  const reportUrl = typeof window !== 'undefined' ? window.location.href : `https://ocufi.io/v2/tx/${d.sig}`;
  const shareText = t('share.shareText', { savedSol: fmtNum(d.savedSol, d.solDp) });

  // P4-FE-2 · 试 deeplink · setTimeout 后 fallback web
  // mobile app 装了 deeplink 立即拦截 · iframe blur · timeout 不会 trigger fallback
  // app 没装 · deeplink 失败 · timeout 触发 web URL · 用户仍能分享
  const tryDeeplink = (deeplink: string, fallback: string) => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent;
    const isMobile = /iPhone|iPad|Android|Mobile/i.test(ua);
    if (!isMobile) {
      // 桌面没 app · 直接 web · 走 _blank 不影响当前页
      window.open(fallback, '_blank', 'noopener,noreferrer');
      return;
    }
    // mobile · 同 tab 试 deeplink · 1.2s 后 fallback web
    let didFallback = false;
    const fallbackTimer = window.setTimeout(() => {
      didFallback = true;
      window.location.href = fallback;
    }, 1_200);
    // 装了 app · pagehide / blur 触发 → 取消 fallback
    const onHide = () => {
      if (didFallback) return;
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('blur', onHide);
    };
    window.addEventListener('pagehide', onHide, { once: true });
    window.addEventListener('blur', onHide, { once: true });
    window.location.href = deeplink;
  };

  const handleTweet = () => {
    // X(Twitter)deeplink: twitter://post?message=...
    // web fallback: https://x.com/intent/post?text=...&url=...(Twitter 已改名 X)
    const text = `${shareText} ${reportUrl}`;
    tryDeeplink(
      `twitter://post?message=${encodeURIComponent(text)}`,
      `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(reportUrl)}`,
    );
  };
  const handleCopy = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(reportUrl);
      toast(t('share.copied'));
    } catch {
      toast(t('share.copied'));
    }
  };
  const handleTelegram = () => {
    // Telegram deeplink: tg://msg_url?url=&text=
    // web fallback: https://t.me/share/url?url=&text=
    tryDeeplink(
      `tg://msg_url?url=${encodeURIComponent(reportUrl)}&text=${encodeURIComponent(shareText)}`,
      `https://t.me/share/url?url=${encodeURIComponent(reportUrl)}&text=${encodeURIComponent(shareText)}`,
    );
  };

  return (
    <main style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* meta · 2 独立行 · 第 1 行 back/share · 第 2 行 date+slot */}
      <header
        className="v2-tx-meta"
        style={{
          padding: '40px 40px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-60)',
          }}
        >
          <a href="/v2/portfolio" style={{ color: 'var(--ink-60)', textDecoration: 'none' }}>
            {t('back')}
          </a>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              background: 'transparent',
              border: 0,
              padding: 0,
              color: 'var(--ink-60)',
              font: 'inherit',
            }}
          >
            {t('shareLabel')}
          </button>
        </div>
        <div
          className="v2-tx-meta-info"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-40)',
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          <span>{d.timestamp}</span>
          <span>{t('slot', { slot: d.slot.toLocaleString('en-US') })}</span>
        </div>
      </header>

      {/* hero · OG 卡 · subText 2 行 + footLeft/Right 媒查 column */}
      <div style={{ padding: '0 40px' }} className="v2-tx-hero-wrap">
        <OgCard
          variant="tx-hero"
          topLabel={t('transparencyReport', { sigShort: d.sigShort })}
          topRight={t('feePctTag', { pct: fmtNum(d.feePct, 2) })}
          saveText={heroSaveText}
          subText={heroSubLine1}
          subTextLine2={heroSubLine2}
          footLeft={`ocufi.io/v2/tx/${d.sigShort}`}
          footRight={d.savedUsd != null ? t('savedUsd', { usd: fmtNum(d.savedUsd, 2) }) : undefined}
          saveGradient
          tokenLogo={tokenMeta.logoURI ?? undefined}
          tokenSymbol={tokenMeta.symbol}
        />
      </div>

      {/* 4 数据卡 · 4×1 横排(mobile 1 列) */}
      <section
        className="v2-tx-cards"
        style={{
          padding: '56px 40px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          borderBottom: '1px solid var(--border-v2)',
        }}
      >
        <Card
          k={t('card.slippage')}
          v={slippageDisplay}
          sub={slippageSub}
          ok={d.slippagePct != null && d.slippagePct <= d.slippageTolerancePct}
        />
        <Card
          k={t('card.gas')}
          v={`${fmtNum(d.gasSol, 6)} SOL`}
          sub={gasUsdDisplay}
        />
        <Card
          k={t('card.fee')}
          v={`${fmtNum(d.feeSol, 6)} SOL`}
          sub={t('card.feeVsCompetitor', { pct: fmtNum(d.feePct, 2), comp: fmtNum(d.competitorFeePct, 0) })}
        />
        <Card
          k={t('card.route')}
          v={d.routeStr}
          sub={`${finalPriceDisplay} · ${mevDetail}`}
        />
      </section>

      {/* 分享 3 大按钮 */}
      <section
        className="v2-tx-share"
        style={{
          padding: '48px 40px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ink-60)',
          }}
        >
          {t('share.title')}
        </div>
        <div className="v2-tx-share-btns" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ShareBtn primary onClick={handleTweet}>{t('share.tweet')}</ShareBtn>
          <ShareBtn onClick={handleCopy}>{t('share.copy')}</ShareBtn>
          <ShareBtn onClick={handleTelegram}>{t('share.telegram')}</ShareBtn>
        </div>
      </section>

      {/* 工程师视角 ▶ 折叠 · 真有 bundle id / route steps 才展示具体 · 否则 fallback */}
      <section
        style={{
          padding: '28px 40px',
          borderTop: '1px solid var(--border-v2)',
        }}
      >
        <button
          type="button"
          onClick={() => setEngineerOpen((v) => !v)}
          aria-expanded={engineerOpen}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            flexWrap: 'wrap',
            background: 'transparent',
            border: 0,
            padding: 0,
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-40)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 9, color: 'var(--ink-40)' }}>{engineerOpen ? '▼' : '▶'}</span>
          <span>{t('engineer.label')}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-40)', opacity: 0.7 }}>{t('engineer.hint')}</span>
        </button>
        {engineerOpen && (
          <ul style={{ margin: '14px 0 0 22px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
              {t('engineer.bundle', { id: d.mevBundleId ?? t('engineer.empty') })}
            </li>
            <li style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
              {d.jupiterRouteSteps
                ? t('engineer.routeWithSteps', { steps: d.jupiterRouteSteps.length, route: d.routeStr })
                : t('engineer.route', { route: d.routeStr })}
            </li>
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * 找不到 sig 报告时的 fallback · "报告生成中"
 * 链上 swap confirm → 后端写库可能 30s-2min 延迟 · 用户刷新页面 retry
 *
 * P3-FE-2 bug 4 · client 自动 retry 3 次 × 5s · 拿到数据自动渲染真报告
 *   · server SSR 失败(env / network 偶失)client(NEXT_PUBLIC build-inline)能救场
 *   · 拿到 setData → 切换渲染 TxView 真数据 · 不再死板"报告生成中"
 */
export function TxViewFallback({ sig }: { sig: string }) {
  const t = useTranslations('v2.tx');
  const sigShort = sig.length >= 12 ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : sig;
  const [data, setData] = useState<TxViewData | null>(null);
  const triesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function attempt() {
      if (cancelled) return;
      triesRef.current += 1;
      const r = await getTransparencyReport(sig);
      if (cancelled) return;
      if (r) {
        setData(mapReportToView(r));
        return; // 拿到 · 不再 retry
      }
      if (triesRef.current < 3) {
        timer = setTimeout(attempt, 5_000);
      }
    }
    // 首次稍延 1s 防 SSR fetch 同时打 · 后续每 5s
    timer = setTimeout(attempt, 1_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sig]);

  // retry 拿到数据 · 渲染真 TxView
  if (data) {
    return <TxView sig={sig} data={data} />;
  }

  return (
    <main style={{ maxWidth: 920, margin: '0 auto' }}>
      <header
        className="v2-tx-meta"
        style={{
          padding: '40px 40px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-60)',
          }}
        >
          <a href="/v2/portfolio" style={{ color: 'var(--ink-60)', textDecoration: 'none' }}>
            {t('back')}
          </a>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-40)',
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          #{sigShort}
        </div>
      </header>

      <section
        style={{
          margin: '0 40px',
          padding: '48px 32px',
          background: 'var(--bg-card-v2)',
          border: '1px solid var(--border-v2)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-card-v2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 36,
            letterSpacing: '-0.02em',
            color: 'var(--ink-100)',
            lineHeight: 1.15,
          }}
        >
          {t('fallback.title')}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 13,
            color: 'var(--ink-60)',
            maxWidth: 400,
            lineHeight: 1.6,
          }}
        >
          {t('fallback.desc1')}
          <br />
          {t('fallback.desc2')}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <RefreshLink label={t('fallback.refresh')} />
          <a
            href="/v2/portfolio"
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              background: 'var(--bg-card-v2)',
              border: '1px solid var(--border-v2-strong)',
              color: 'var(--ink-100)',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {t('fallback.back')}
          </a>
        </div>
      </section>
    </main>
  );
}

function RefreshLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') window.location.reload();
      }}
      style={{
        padding: '12px 20px',
        borderRadius: 14,
        background: 'var(--brand-soft)',
        border: '1px solid var(--border-brand)',
        color: 'var(--brand-up)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 0 30px rgba(25,251,155,0.18)',
      }}
    >
      {label}
    </button>
  );
}

function Card({ k, v, sub, ok }: { k: string; v: string; sub: string; ok?: boolean }) {
  return (
    <div
      style={{
        padding: '22px 20px',
        background: 'var(--bg-card-v2)',
        border: '1px solid var(--border-v2)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-card-v2)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-40)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          marginBottom: 10,
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 18,
          fontWeight: 500,
          color: ok ? 'var(--brand-up)' : 'var(--ink-100)',
          display: ok ? 'inline-flex' : 'block',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {v}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-60)',
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          marginTop: 6,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function ShareBtn({
  primary,
  onClick,
  children,
}: {
  primary?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        height: 48,
        padding: '0 20px',
        borderRadius: 14,
        background: primary ? 'var(--brand-soft)' : 'var(--bg-card-v2)',
        border: `1px solid ${primary ? 'var(--border-brand)' : 'var(--border-v2-strong)'}`,
        color: primary ? 'var(--brand-up)' : 'var(--ink-100)',
        fontSize: 14,
        fontFamily: 'inherit',
        fontWeight: primary ? 600 : 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        boxShadow: primary ? '0 0 30px rgba(25,251,155,0.18)' : 'none',
      }}
    >
      {children}
    </button>
  );
}
