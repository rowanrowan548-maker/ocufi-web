/**
 * V2 TX View · /v2/tx/[sig] · Phase 2 mock 数据 UI 第 1 稿
 *
 * 数据真接通等 Phase 3:后端 /transparency/<sig> + 链上 swap confirm 后上报
 * 当前 mock:写死一组合理数(参 mockup `.coordination/V2/MOCKUPS/v2-overall.html` `/tx`)
 *
 * 视觉对齐 P0-2-HOTFIX-2 钦定:
 *   - meta(back/share + 时间/slot)收紧
 *   - OG 卡升顶为 hero 玻璃容器(760×420 brand→cyan 渐变 72px Newsreader italic)
 *   - 4 数据卡 4×1 横排
 *   - 分享 3 大按钮 56px(主推 brand 描边 + glow)
 *   - 工程师视角 ▶ 折叠下移
 */
import { OgCard } from '@/components/v2/shared/og-card';

type TxData = {
  sig: string;
  wallet: string;
  timestamp: string;       // 'YYYY-MM-DD · HH:MM UTC'
  slot: number;
  // hero
  savedSol: number;
  savedUsd: number;
  buyAmount: number;       // tokens received
  buySymbol: string;
  paySol: number;
  vsCompetitorSol: number;
  // cards
  slippagePct: number;
  slippageTolerancePct: number;
  gasSol: number;
  gasUsd: number;
  feeSol: number;
  feePct: number;
  competitorFeePct: number;
  route: string;
  finalPriceUsd: number;
  refPriceUsd: number;
  mevProtected: boolean;
  mevBlockedCount: number;
};

// Phase 2 · mock data · 跟 mockup 一致的演示数(BONK 0.5 SOL → 1.23M)
const MOCK: TxData = {
  sig: '5fXq8y...abc7e2',
  wallet: '7w...g4w',
  timestamp: '2026-05-08 · 14:23 UTC',
  slot: 287_432_118,
  savedSol: 0.0045,
  savedUsd: 0.9,
  buyAmount: 1_234_567,
  buySymbol: 'BONK',
  paySol: 0.5,
  vsCompetitorSol: 0.5045,
  slippagePct: 0.32,
  slippageTolerancePct: 1,
  gasSol: 0.000054,
  gasUsd: 0.011,
  feeSol: 0.0005,
  feePct: 0.1,
  competitorFeePct: 1,
  route: 'Jupiter v6',
  finalPriceUsd: 0.000121,
  refPriceUsd: 0.00012,
  mevProtected: true,
  mevBlockedCount: 1,
};

function fmtNum(n: number, dp = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function TxView({ sig }: { sig: string }) {
  // Phase 2 · 任何 sig 都给 mock(待 P3 接 /transparency/<sig>)
  const d: TxData = { ...MOCK, sig: sig.length >= 8 ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : MOCK.sig };

  return (
    <main style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* meta · back/share + 时间/slot */}
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
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-40)',
          }}
        >
          <span>{d.timestamp}</span>
          <span>Solana · Slot {d.slot.toLocaleString('en-US')}</span>
        </div>
      </header>

      {/* hero 玻璃容器(OgCard tx-hero variant) */}
      <div style={{ padding: '0 40px' }} className="v2-tx-hero-wrap">
        <OgCard
          variant="tx-hero"
          topLabel={`TRANSPARENCY REPORT · #${d.sig}`}
          topRight={`${d.feePct}% FEE`}
          saveText={`省了 ${d.savedSol} SOL`}
          subText={`买入 ${d.buyAmount.toLocaleString('en-US')} ${d.buySymbol} · 花费 ${d.paySol} SOL · vs BullX ${d.vsCompetitorSol} SOL · 防夹保护 ${d.mevProtected ? '✓' : '—'}`}
          footLeft={`ocufi.io/tx/${d.sig}`}
          footRight={`≈ $${fmtNum(d.savedUsd)} saved`}
          saveGradient
        />
      </div>

      {/* 4 数据卡 · 4×1 横排(mobile 1 列堆叠) */}
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
          v={`✓ ${d.slippagePct}%`}
          sub={`容忍 ${d.slippageTolerancePct}%`}
          ok
        />
        <Card
          k="Gas 消耗"
          v={`${d.gasSol} SOL`}
          sub={`≈ $${fmtNum(d.gasUsd, 3)}`}
        />
        <Card
          k="手续费"
          v={`${d.feeSol} SOL`}
          sub={`${d.feePct}% · vs BullX ${d.competitorFeePct}%`}
        />
        <Card
          k="路由 · 终价"
          v={d.route}
          sub={`$${fmtNum(d.finalPriceUsd, 6)} · ${d.mevProtected ? `拦 ${d.mevBlockedCount} 次三明治` : '无防夹'}`}
        />
      </section>

      {/* 分享 3 大按钮 · 56px · 主推 brand 描边 */}
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
        <div className="v2-tx-share-btns" style={{ display: 'flex', gap: 10 }}>
          <ShareBtn primary>↗  发推</ShareBtn>
          <ShareBtn>📋  复制链接</ShareBtn>
          <ShareBtn>✈  TG 分享</ShareBtn>
        </div>
      </section>

      {/* 工程师视角 ▶ 折叠 · Phase 3 接桑基图 */}
      <section
        style={{
          padding: '28px 40px',
          borderTop: '1px solid var(--border-v2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 13,
            color: 'var(--ink-60)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 9, color: 'var(--ink-40)' }}>▶</span>
          工程师视角(查看 Sender bundle 详情 + 桑基图路由)
        </div>
      </section>
    </main>
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
        height: 56,
        padding: '0 26px',
        borderRadius: 14,
        background: primary ? 'var(--brand-soft)' : 'var(--bg-card-v2)',
        border: `1px solid ${primary ? 'var(--border-brand)' : 'var(--border-v2-strong)'}`,
        color: primary ? 'var(--brand-up)' : 'var(--ink-100)',
        fontSize: 14,
        fontFamily: 'inherit',
        fontWeight: primary ? 600 : 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: primary ? '0 0 30px rgba(25,251,155,0.18)' : 'none',
      }}
    >
      {children}
    </button>
  );
}
