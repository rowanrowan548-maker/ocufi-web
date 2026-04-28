'use client';

/**
 * T-INV-113 · 我的下线列表(collapse)
 *
 * 后端: GET /invite/downstream?wallet=&page=&page_size= (T-945 已 ship)
 * 行为:
 *  - 首次展开时 fetch · 缓存到组件 state
 *  - 列出钱包末 4 位 + 首笔时间 + 累计返佣 SOL
 *  - 空态:还没有下线
 *  - 错误时降级 inline message
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { ChevronDown, Users, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  fetchInviteDownstream,
  isApiConfigured,
  type DownstreamRow,
} from '@/lib/api-client';

const PAGE_SIZE = 20;

export function DownstreamList() {
  const t = useTranslations('invite.downstream');
  const wallet = useWallet();
  const addr = wallet.publicKey?.toBase58() ?? '';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DownstreamRow[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !addr || !isApiConfigured()) return;
    if (items !== null) return; // 已 fetch 过
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchInviteDownstream(addr, 1, PAGE_SIZE)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items ?? []);
        setTotal(r.total ?? r.items?.length ?? 0);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, addr, items]);

  // 钱包变 → 清缓存
  useEffect(() => {
    setItems(null);
    setTotal(null);
    setError(null);
  }, [addr]);

  const headerCount = total ?? '?';

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition"
        >
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {t('title', { n: typeof headerCount === 'number' ? headerCount : 0 })}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="border-t border-border/40">
            {loading && (
              <div className="p-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('loading')}
              </div>
            )}
            {error && !loading && (
              <div className="p-4 flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span className="break-all">{error}</span>
              </div>
            )}
            {!loading && !error && items && items.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground/70 space-y-1">
                <p>{t('empty.title')}</p>
                <p className="text-[10px] text-muted-foreground/50">{t('empty.hint')}</p>
              </div>
            )}
            {!loading && !error && items && items.length > 0 && (
              <ul className="divide-y divide-border/30">
                {items.map((row) => (
                  <li key={row.wallet}>
                    <DownstreamRowView row={row} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DownstreamRowView({ row }: { row: DownstreamRow }) {
  const t = useTranslations('invite.downstream');
  const tail = row.wallet.slice(-4);
  const firstTradeLabel = row.first_trade_at
    ? formatDate(row.first_trade_at)
    : t('noTradeYet');
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-xs">
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-foreground">…{tail}</span>
        <span className="text-[10px] text-muted-foreground/60">{firstTradeLabel}</span>
      </div>
      <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
        {t('rebate')}
      </span>
      <span className="font-mono tabular-nums text-foreground">
        {row.total_rebate_sol.toFixed(4)} SOL
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
