'use client';

/**
 * V2 Reports List · /v2/reports
 *
 * P3-FE-7 · 用户暴怒"报告只能看最近一笔" · 真历史列表 · 跨设备同步
 *
 * 数据源:GET /transparency/recent?wallet=<addr>&limit=50
 *   · 后端 P3-BE-2 ship · 返 [{sig, created_at}]
 *   · wallet 必传 · 没连钱包 → 提示连钱包
 *   · 空数组 → "还没有交易报告" empty state(完成首笔 swap 后写库)
 *
 * 列表项:date + sig 短 + "查看报告 →" → 点跳 /v2/tx/<sig>
 *   · side / token / savings 暂不显(后端 recent 只返 sig + created_at)
 *   · 后续 BE 扩展 endpoint 时再加 · 不阻塞当前 ship
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { apiFetch } from '@/lib/api-client';

type RecentItem = { sig: string; created_at: string };
type RecentResponse = { ok: boolean; error: string | null; data: RecentItem[] };

type ListState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; items: RecentItem[] }
  | { kind: 'error' };

export function ReportsView() {
  const t = useTranslations('v2.reports');
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [state, setState] = useState<ListState>({ kind: 'idle' });

  useEffect(() => {
    if (!wallet) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    apiFetch<RecentResponse>(`/transparency/recent?wallet=${encodeURIComponent(wallet)}&limit=50`)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && Array.isArray(res.data)) {
          setState({ kind: 'ok', items: res.data });
        } else {
          setState({ kind: 'error' });
        }
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

      <section style={{ padding: '24px 40px 80px' }}>
        {state.kind === 'idle' && !wallet && (
          <EmptyMsg text={t('connectWallet')} />
        )}
        {state.kind === 'loading' && (
          <EmptyMsg text="..." />
        )}
        {state.kind === 'error' && (
          <EmptyMsg text={t('loadError')} />
        )}
        {state.kind === 'ok' && state.items.length === 0 && (
          <EmptyMsg text={t('empty')} />
        )}
        {state.kind === 'ok' && state.items.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state.items.map((it) => (
              <li key={it.sig}>
                <ReportRow item={it} viewLabel={t('viewReport')} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ReportRow({ item, viewLabel }: { item: RecentItem; viewLabel: string }) {
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
        padding: '18px 20px',
        background: 'var(--bg-card-v2)',
        border: '1px solid var(--border-v2)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-card-v2)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 13,
            color: 'var(--ink-100)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          #{sigShort}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 11,
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
          fontSize: 12,
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
