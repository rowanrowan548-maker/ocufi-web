'use client';

/**
 * T-906b · /badges 页完整实现
 *
 * - 顶部:连接钱包提示(未连接显示 CTA)
 * - 5 枚徽章 grid:已得高亮 / 未得灰显 + 进度条
 * - 排行榜 top 20:rank / wallet 截断 / 徽章数 / 加权分
 *
 * 数据:
 *   GET /badges/all — 列定义
 *   GET /badges/me?wallet=X — 已得 + progress
 *   GET /badges/leaderboard — 排行
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  fetchAllBadges,
  fetchMyBadges,
  fetchBadgesLeaderboard,
  isApiConfigured,
  type BadgeDef,
  type UserBadgeEarned,
  type BadgeProgress,
  type BadgeLeaderRow,
} from '@/lib/api-client';

import { BadgeIcon } from './badge-icon';

interface BadgeWithProgress extends BadgeDef {
  earned: boolean;
  earnedAt: string | null;
  current: number;
  target: number;
}

const TARGETS: Record<string, { field: keyof BadgeProgress; target: number }> = {
  early_bird: { field: 'registrationOrder', target: 1000 },
  first_trade: { field: 'swapCount', target: 1 },
  veteran: { field: 'swapCount', target: 10 },
  inviter: { field: 'inviteCount', target: 3 },
  volume_100: { field: 'totalVolumeSol', target: 100 },
};

export function BadgesView() {
  const t = useTranslations();
  const locale = useLocale();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [defs, setDefs] = useState<BadgeDef[] | null>(null);
  const [earned, setEarned] = useState<UserBadgeEarned[]>([]);
  const [progress, setProgress] = useState<BadgeProgress | null>(null);
  const [leader, setLeader] = useState<BadgeLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const walletAddr = wallet.publicKey?.toBase58() ?? '';

  useEffect(() => {
    if (!isApiConfigured()) {
      setError('API not configured');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [allResp, leaderResp] = await Promise.all([
          fetchAllBadges(),
          fetchBadgesLeaderboard(20),
        ]);
        if (cancelled) return;
        setDefs(allResp.badges ?? []);
        setLeader(leaderResp.leaderboard ?? []);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!walletAddr || !isApiConfigured()) {
      setEarned([]);
      setProgress(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMyBadges(walletAddr);
        if (cancelled) return;
        setEarned(me.earned ?? []);
        setProgress(
          me.progress && 'swapCount' in me.progress
            ? (me.progress as BadgeProgress)
            : null
        );
      } catch {
        if (!cancelled) {
          setEarned([]);
          setProgress(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddr]);

  const merged = useMemo<BadgeWithProgress[]>(() => {
    if (!defs) return [];
    const earnedMap = new Map(earned.map((e) => [e.code, e]));
    return defs
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((d) => {
        const e = earnedMap.get(d.code);
        const tg = TARGETS[d.code];
        const cur = tg && progress ? Number(progress[tg.field] ?? 0) : 0;
        return {
          ...d,
          earned: !!e,
          earnedAt: e?.earnedAt ?? null,
          current: tg ? Math.min(cur, tg.target) : 0,
          target: tg?.target ?? 1,
        };
      });
  }, [defs, earned, progress]);

  const earnedCount = earned.length;

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* 钱包连接提示 */}
      {!wallet.connected && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t('badges.connect')}
            </p>
            <Button onClick={() => openWalletModal(true)} size="sm">
              {t('wallet.connect')}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="text-xs text-danger break-all">{error}</div>
      )}

      {/* 徽章 grid */}
      {wallet.connected && (
        <div className="text-sm text-muted-foreground">
          {t('badges.earnedSummary', {
            earned: earnedCount,
            total: defs?.length ?? 0,
          })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(merged.length > 0
          ? merged
          : Array.from({ length: 5 }).map<BadgeWithProgress>(() => ({
              code: '',
              nameZh: '',
              nameEn: '',
              descriptionZh: '',
              descriptionEn: '',
              icon: 'HelpCircle',
              rarity: 'common',
              sortOrder: 0,
              earned: false,
              earnedAt: null,
              current: 0,
              target: 1,
            }))
        ).map((b, i) => (
          <Card
            key={b.code || i}
            className={
              b.earned
                ? 'border-success/30 hover:border-success/50 transition-colors'
                : 'hover:border-primary/30 transition-colors'
            }
          >
            <CardContent className="py-4 flex flex-col items-center text-center gap-2">
              {loading ? (
                <div className="h-20 w-20 rounded-full bg-muted/30 animate-pulse" />
              ) : (
                <BadgeIcon
                  icon={b.icon}
                  rarity={b.rarity}
                  earned={b.earned}
                  size={80}
                />
              )}
              <div className="font-medium text-sm">
                {b.code ? (locale.startsWith('zh') ? b.nameZh : b.nameEn) : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground/70 leading-snug min-h-[2.5em]">
                {b.code ? (locale.startsWith('zh') ? b.descriptionZh : b.descriptionEn) : ''}
              </div>
              {b.code && (
                b.earned ? (
                  <div className="text-[10px] uppercase tracking-wider text-success font-mono">
                    {t('badges.earned')}
                  </div>
                ) : (
                  <div className="w-full space-y-1">
                    <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full bg-primary/60 transition-all"
                        style={{
                          width: `${Math.min(100, (b.current / Math.max(b.target, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 font-mono tabular-nums">
                      {b.current} / {b.target}
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 排行榜 */}
      <div>
        <h2 className="text-base font-semibold mb-3">
          {t('badges.leaderboard.title')}
        </h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {t('badges.leaderboard.rank')}
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {t('badges.leaderboard.wallet')}
                  </TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {t('badges.leaderboard.count')}
                  </TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {t('badges.leaderboard.score')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leader.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                      {loading ? '…' : t('badges.leaderboard.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  leader.map((r, i) => (
                    <TableRow key={r.wallet}>
                      <TableCell className="font-mono text-xs">#{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.wallet.slice(0, 4)}…{r.wallet.slice(-4)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.count}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.score}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="text-center pt-2">
        <Link
          href="/portfolio"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← {t('badges.backToPortfolio')}
        </Link>
      </div>
    </div>
  );
}
