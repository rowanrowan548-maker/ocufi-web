'use client';

/**
 * V2 Reports List · /v2/reports
 *
 * P3-FE-7 第一版 · flat list · 用户原话"直接显示一堆 · 太不美观"
 * P3-FE-9 redesign 方向 A:
 *   [hero 大卡 · 最近一笔]      OG card 风格 · "省了 X SOL on $TOKEN" · brand glow
 *   ▼ 查看历史 (N 笔)            默认折叠
 *
 * 数据流:
 *   1. GET /transparency/recent?wallet=<addr>&limit=50  (sig + created_at)
 *   2. 取第 0 笔 sig · 调 getTransparencyReport(sig) 拿真 detail · mapReportToView
 *   3. hero 渲染 detail · 折叠列表渲染剩余 N-1 笔(轻量 sig + date)
 *
 * 0 报告 / 没连钱包 / 加载失败 三态
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { apiFetch } from '@/lib/api-client';
import { getTransparencyReport, mapReportToView, type TxViewData } from '@/lib/transparency';

type RecentItem = { sig: string; created_at: string };
type RecentResponse = { ok: boolean; error: string | null; data: RecentItem[] };

type ListState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; items: RecentItem[]; hero: TxViewData | null }
  | { kind: 'error' };

export function ReportsView() {
  const t = useTranslations('v2.reports');
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [state, setState] = useState<ListState>({ kind: 'idle' });
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    apiFetch<RecentResponse>(`/transparency/recent?wallet=${encodeURIComponent(wallet)}&limit=50`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok || !Array.isArray(res.data)) {
          setState({ kind: 'error' });
          return;
        }
        const items = res.data;
        // 取第 0 笔 sig 拿 hero detail · 失败时 hero=null · 列表照旧
        let hero: TxViewData | null = null;
        if (items.length > 0) {
          try {
            const r = await getTransparencyReport(items[0].sig);
            if (!cancelled && r) hero = mapReportToView(r);
          } catch {
            /* hero 拿不到 · 列表照旧渲染 */
          }
        }
        if (cancelled) return;
        setState({ kind: 'ok', items, hero });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  return (
    <main style={{ maxWidth: 920, margin: '0 auto' }}>
      <header
        style={{
          padding: '40px 40px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <a
          href="/v2/portfolio"
          style={{
            color: 'var(--ink-60)',
            textDecoration: 'none',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
          }}
        >
          {t('back')}
        </a>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 36,
            letterSpacing: '-0.02em',
            color: 'var(--ink-100)',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          {t('title')}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 13,
            color: 'var(--ink-60)',
            lineHeight: 1.6,
            margin: 0,
            maxWidth: 600,
          }}
        >
          {t('subtitle')}
        </p>
      </header>

      <section style={{ padding: '8px 40px 80px' }}>
        {state.kind === 'idle' && !wallet && <EmptyMsg text={t('connectWallet')} />}
        {state.kind === 'loading' && <EmptyMsg text="…" />}
        {state.kind === 'error' && <EmptyMsg text={t('loadError')} />}
        {state.kind === 'ok' && state.items.length === 0 && (
          <EmptyState title={t('emptyTitle')} sub={t('emptySub')} ctaLabel={t('emptyCta')} ctaHref="/v2" />
        )}
        {state.kind === 'ok' && state.items.length > 0 && (
          <>
            {/* hero 大卡 · 最近一笔 */}
            <HeroCard
              item={state.items[0]}
              detail={state.hero}
              labels={{
                heroEyebrow: t('heroEyebrow'),
                viewFull: t('viewFull'),
                savedPrefix: t('savedPrefix'),
                savedSuffix: t('savedSuffix'),
                onToken: t('onToken'),
                noFee: t('noFee'),
              }}
            />

            {/* 折叠 · 查看历史(N-1 笔)*/}
            {state.items.length > 1 && (
              <div style={{ marginTop: 28 }}>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-expanded={historyOpen}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'transparent',
                    border: 0,
                    padding: '6px 0',
                    fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                    fontSize: 13,
                    color: 'var(--ink-60)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 9, color: 'var(--ink-40)' }}>{historyOpen ? '▼' : '▶'}</span>
                  {t('history', { n: state.items.length - 1 })}
                </button>
                {historyOpen && (
                  <ul style={{ margin: '14px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {state.items.slice(1).map((it) => (
                      <li key={it.sig}>
                        <HistoryRow item={it} viewLabel={t('viewReport')} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function HeroCard({
  item,
  detail,
  labels,
}: {
  item: RecentItem;
  detail: TxViewData | null;
  labels: {
    heroEyebrow: string;
    viewFull: string;
    savedPrefix: string;
    savedSuffix: string;
    onToken: string;
    noFee: string;
  };
}) {
  const sigShort = item.sig.length >= 12 ? `${item.sig.slice(0, 6)}...${item.sig.slice(-4)}` : item.sig;
  const dateStr = formatDate(item.created_at);
  const savedSol = detail?.savedSol ?? null;
  const tokenSymbol = detail?.tokenSymbol ?? null;
  const solDp = detail?.solDp ?? 4;

  // hero 大字:有 detail 显 "省了 X SOL on $TOKEN" / 没就 fallback "#sigShort · 查看详情"
  const heroBig =
    savedSol != null && savedSol > 0 && tokenSymbol
      ? `${labels.savedPrefix} ${fmtNum(savedSol, solDp)} ${labels.savedSuffix}`
      : savedSol === 0 && tokenSymbol
      ? labels.noFee
      : `#${sigShort}`;
  const heroSub = tokenSymbol ? `${labels.onToken} $${tokenSymbol}` : null;

  return (
    <Link
      href={`/v2/tx/${item.sig}`}
      prefetch={false}
      style={{
        display: 'block',
        padding: '32px 28px',
        borderRadius: 20,
        background: 'linear-gradient(135deg, rgba(25,251,155,0.08), rgba(11,13,18,0.92))',
        border: '1px solid var(--border-brand-soft)',
        boxShadow: 'var(--shadow-glow-v2)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--brand-up)',
          marginBottom: 16,
        }}
      >
        {labels.heroEyebrow} · #{sigShort}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 'clamp(36px, 6vw, 56px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: 'var(--ink-100)',
        }}
      >
        {heroBig}
      </div>
      {heroSub && (
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 14,
            color: 'var(--ink-80)',
          }}
        >
          {heroSub}
        </div>
      )}
      <div
        style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 12,
          color: 'var(--ink-60)',
        }}
      >
        <span>{dateStr}</span>
        <span style={{ color: 'var(--brand-up)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {labels.viewFull}
        </span>
      </div>
    </Link>
  );
}

function HistoryRow({ item, viewLabel }: { item: RecentItem; viewLabel: string }) {
  const sigShort = item.sig.length >= 12 ? `${item.sig.slice(0, 6)}...${item.sig.slice(-4)}` : item.sig;
  const dateStr = formatDate(item.created_at);
  return (
    <Link
      href={`/v2/tx/${item.sig}`}
      prefetch={false}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 18px',
        background: 'var(--bg-card-v2)',
        border: '1px solid var(--border-v2)',
        borderRadius: 12,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--ink-100)',
            fontWeight: 500,
          }}
        >
          #{sigShort}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 10,
            color: 'var(--ink-40)',
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {dateStr}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 11,
          color: 'var(--brand-up)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {viewLabel}
      </span>
    </Link>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '40px 24px',
        textAlign: 'center',
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
        fontSize: 13,
        color: 'var(--ink-60)',
        background: 'var(--bg-card-v2)',
        border: '1px solid var(--border-v2)',
        borderRadius: 14,
      }}
    >
      {text}
    </div>
  );
}

function EmptyState({ title, sub, ctaLabel, ctaHref }: { title: string; sub: string; ctaLabel: string; ctaHref: string }) {
  return (
    <div
      style={{
        padding: '56px 32px',
        textAlign: 'center',
        background: 'var(--bg-card-v2)',
        border: '1px solid var(--border-brand-soft)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-glow-v2)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 'clamp(24px, 5vw, 32px)',
          color: 'var(--brand-up)',
          marginBottom: 14,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-60)', marginBottom: 24, lineHeight: 1.5 }}>{sub}</div>
      <Link
        href={ctaHref}
        prefetch={false}
        style={{
          display: 'inline-block',
          background: 'var(--brand-up)',
          color: 'var(--bg-base)',
          padding: '12px 28px',
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
          textDecoration: 'none',
          letterSpacing: '-0.01em',
          boxShadow: '0 0 24px rgba(25,251,155,0.28)',
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

function fmtNum(n: number, dp = 4): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} · ${h}:${m} UTC`;
  } catch {
    return iso;
  }
}
