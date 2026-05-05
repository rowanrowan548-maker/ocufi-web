'use client';

/**
 * V2 TX View · /v2/tx/[sig]
 *
 * P3-FE-1:接真数据(SPEC §4.2 字段映射)· demo sig 走 mock
 *   - data 传 → 渲染真透明度报告
 *   - demo=true → 渲染 mock(nav "Demo" tab 用)
 *   - 都没 → 兜底 mock(防意外路径)
 *
 * P2-MOBILE-OVERHAUL polish 保留:
 *   - meta 拆 2 独立行(back/share / date · UTC / Solana · Slot)避 320 粘连
 *   - hero subText 拆 2 行 · 防夹保护 ✓ brand-up 强调
 *   - OG card url + saved 拆 2 行(媒查)避 320 行尾错位
 *   - 工程师视角 ▶ 默认折叠
 *   - 3 分享按钮 column 列 + w-full + h-12 等宽等高
 */
import { useState } from 'react';
import { OgCard } from '@/components/v2/shared/og-card';
import type { TxViewData } from '@/lib/transparency';

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
  tokenAmount: 1_234_567,
  tokenSymbol: 'BONK',
  notionalSol: 0.5,
  vsCompetitorSol: 0.5045,
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
  // 优先级:demo → MOCK + sigShort 替换 / data → 真 / fallback → MOCK
  const d: TxViewData = data
    ?? (demo
      ? { ...MOCK, sig, sigShort: sig.length >= 12 ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : MOCK.sigShort }
      : MOCK);
  const [engineerOpen, setEngineerOpen] = useState(false);

  // P2-MOBILE-OVERHAUL #4 · subText 拆 2 行 · 第 2 行 brand-up 强调 ✓
  const tokenAmountStr = d.tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 4 });
  const sideVerb = d.side === 'buy' ? '买入' : '卖出';
  const heroSubLine1 = `${sideVerb} ${tokenAmountStr} ${d.tokenSymbol} · ${d.side === 'buy' ? '花费' : '换得'} ${fmtNum(d.notionalSol, 4)} SOL`;
  const heroSubLine2 = (
    <>
      vs BullX {fmtNum(d.vsCompetitorSol, 4)} SOL ·{' '}
      <span style={{ color: 'var(--brand-up)' }}>防夹保护 {d.mevProtected ? '✓' : '—'}</span>
    </>
  );

  const slippageDisplay = d.slippagePct == null ? '—' : `✓ ${fmtNum(d.slippagePct, 2)}%`;
  const slippageSub = `容忍 ${fmtNum(d.slippageTolerancePct, 0)}%`;
  const gasUsdDisplay = d.gasUsd == null ? '—' : `≈ $${fmtNum(d.gasUsd, 3)}`;
  const finalPriceDisplay = d.finalPriceUsd == null ? '—' : `$${fmtNum(d.finalPriceUsd, 6)}`;
  const mevDetail = d.mevProtected
    ? (d.mevBundleId ? `Helius bundle ✓` : '走 Sender · 已保护')
    : '无防夹';

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
            ‹ 持仓
          </a>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            ↗ 分享
          </span>
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
          <span>Solana · Slot {d.slot.toLocaleString('en-US')}</span>
        </div>
      </header>

      {/* hero · OG 卡 · subText 2 行 + footLeft/Right 媒查 column */}
      <div style={{ padding: '0 40px' }} className="v2-tx-hero-wrap">
        <OgCard
          variant="tx-hero"
          topLabel={`TRANSPARENCY REPORT · #${d.sigShort}`}
          topRight={`${fmtNum(d.feePct, 2)}% FEE`}
          saveText={`省了 ${fmtNum(d.savedSol, 4)} SOL`}
          subText={heroSubLine1}
          subTextLine2={heroSubLine2}
          footLeft={`ocufi.io/v2/tx/${d.sigShort}`}
          footRight={d.savedUsd != null ? `≈ $${fmtNum(d.savedUsd, 2)} saved` : undefined}
          saveGradient
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
          k="实际滑点"
          v={slippageDisplay}
          sub={slippageSub}
          ok={d.slippagePct != null && d.slippagePct <= d.slippageTolerancePct}
        />
        <Card
          k="Gas 消耗"
          v={`${fmtNum(d.gasSol, 6)} SOL`}
          sub={gasUsdDisplay}
        />
        <Card
          k="手续费"
          v={`${fmtNum(d.feeSol, 6)} SOL`}
          sub={`${fmtNum(d.feePct, 2)}% · vs BullX ${fmtNum(d.competitorFeePct, 0)}%`}
        />
        <Card
          k="路由 · 终价"
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
          分享这笔交易
        </div>
        <div className="v2-tx-share-btns" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ShareBtn primary>↗ 发推</ShareBtn>
          <ShareBtn>📋 复制链接</ShareBtn>
          <ShareBtn>✈ TG 分享</ShareBtn>
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
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 0,
            padding: 0,
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 13,
            color: 'var(--ink-60)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 9, color: 'var(--ink-40)' }}>{engineerOpen ? '▼' : '▶'}</span>
          工程师视角
        </button>
        {engineerOpen && (
          <ul style={{ margin: '14px 0 0 22px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
              · Sender bundle:{d.mevBundleId ? d.mevBundleId : '—'}
            </li>
            <li style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
              · Jupiter 路径:{d.jupiterRouteSteps ? `${d.jupiterRouteSteps.length} 步 · ${d.routeStr}` : d.routeStr}
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
 */
export function TxViewFallback({ sig }: { sig: string }) {
  const sigShort = sig.length >= 12 ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : sig;
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
            ‹ 持仓
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
          报告生成中
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
          链上确认后 · 报告需 30 秒 - 2 分钟写入。
          <br />
          请稍后刷新 · 或回到持仓查看其他交易。
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <RefreshLink />
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
            回持仓
          </a>
        </div>
      </section>
    </main>
  );
}

function RefreshLink() {
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
      ↻ 刷新
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
  children,
}: {
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
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
