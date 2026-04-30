'use client';

/**
 * T-REWARDS-PAGE · Tab 2 · MEV 返还历史
 *
 * 数据源:localStorage(execute-swap-plan 的 recordMevIfPositive 写入)
 *  - mev_total_lamports:累计
 *  - mev_history[]:每笔 {tx, amount_lamports, ts, token_symbol}
 *
 * 显示:顶部大数字 + 列表(倒序 · click 跳 Solscan)
 * 空态:鼓励 + gmgn 对比
 */
import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getMevTotalLamports, getMevHistory } from '@/lib/rewards-storage';

const subscribeStorage = (cb: () => void) => {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
};

// useSyncExternalStore 要求 server snapshot 引用稳定 · 共享实例
const SERVER_HISTORY: never[] = [];
const getServerHistory = () => SERVER_HISTORY;
const getServerZero = () => 0;

export function MevHistoryTab() {
  const t = useTranslations('rewards.mev');
  const totalLamports = useSyncExternalStore(subscribeStorage, getMevTotalLamports, getServerZero);
  const history = useSyncExternalStore(subscribeStorage, getMevHistory, getServerHistory);

  const totalSol = totalLamports / 1e9;

  return (
    <div className="space-y-3">
      {/* 顶部大数字 */}
      <Card>
        <CardContent className="p-5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            {t('totalLabel')}
          </div>
          <div
            className="font-mono text-3xl font-semibold text-[var(--brand-up)]"
            data-testid="mev-total-sol"
          >
            {totalSol.toFixed(6)} SOL
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{t('totalHint')}</div>
        </CardContent>
      </Card>

      {/* 列表 / 空态 */}
      {history.length === 0 ? (
        <Card>
          <CardContent
            className="p-6 text-center space-y-2 text-muted-foreground"
            data-testid="mev-history-empty"
          >
            <Zap className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <div className="text-sm">{t('emptyTitle')}</div>
            <div className="text-xs max-w-md mx-auto">{t('emptyDesc')}</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* T-FE-MOBILE-RESCUE-P0:item 高 ≥ 56px(p-4) · 数字字号 sm:text-sm · solscan 链接热区扩大 */}
            <ul className="divide-y divide-border/40" data-testid="mev-history-list">
              {history.map((e) => (
                <li
                  key={e.tx}
                  className="flex items-center justify-between gap-3 p-4 sm:p-3 min-h-14"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-xs font-medium">
                      {e.token_symbol || '—'}
                    </div>
                    <div className="text-[11px] sm:text-[10px] text-muted-foreground">
                      {formatTime(e.ts)}
                    </div>
                  </div>
                  <div className="text-right font-mono flex-shrink-0">
                    <div className="text-base sm:text-sm font-medium text-[var(--brand-up)]">
                      +{(e.amount_lamports / 1e9).toFixed(6)} SOL
                    </div>
                    <a
                      href={`https://solscan.io/tx/${e.tx}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] sm:text-[10px] text-muted-foreground hover:text-foreground active:text-foreground inline-flex items-center gap-0.5 py-0.5"
                    >
                      {e.tx.slice(0, 4)}…{e.tx.slice(-4)}
                      <ExternalLink className="h-3 w-3 sm:h-2.5 sm:w-2.5" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  // YYYY-MM-DD HH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
