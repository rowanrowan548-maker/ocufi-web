'use client';

/**
 * 积分页 · 我的积分 + 排行榜
 * 未连接钱包:只显示排行榜(全网可见)
 * 已连接:上半部分显示我的积分
 */
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { Trophy, Award, Wallet, RefreshCw, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  fetchPointsMe, fetchLeaderboard, isApiConfigured,
  type PointsMe, type Leaderboard,
} from '@/lib/api-client';

export function PointsView() {
  const t = useTranslations();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [me, setMe] = useState<PointsMe | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [meRes, lb] = await Promise.all([
          wallet.publicKey
            ? fetchPointsMe(wallet.publicKey.toBase58()).catch(() => null)
            : Promise.resolve(null),
          fetchLeaderboard(20).catch(() => null),
        ]);
        if (cancelled) return;
        setMe(meRes);
        setBoard(lb);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [wallet.publicKey, tick]);

  if (!isApiConfigured()) {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('points.apiNotConfigured')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* 我的积分 · gmgn 式大数字卡片 */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 100% 0%, oklch(0.88 0.25 155 / 10%), transparent 70%)',
          }}
        />
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Award className="h-3.5 w-3.5" />
              {t('points.myBalance')}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-8 px-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {!wallet.connected || !wallet.publicKey ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Wallet className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">{t('points.connectToSee')}</div>
              <Button size="sm" onClick={() => openWalletModal(true)}>
                {t('wallet.connect')}
              </Button>
            </div>
          ) : (
            <div>
              <div className="text-5xl font-bold font-mono text-primary tracking-tight">
                {me ? me.balance.toLocaleString() : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
                {me
                  ? t('points.eventCount', { n: me.event_count })
                  : loading
                  ? t('common.loading')
                  : t('points.noRecords')}
                <span className="text-border">·</span>
                <span className="font-mono">{shortAddr(wallet.publicKey.toBase58())}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 规则提示 */}
      <Card className="bg-muted/30">
        <CardContent className="py-4 text-xs text-muted-foreground space-y-1">
          <div className="font-medium text-foreground flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" />
            {t('points.rules.title')}
          </div>
          <div>· {t('points.rules.perSwap')}</div>
          <div>· {t('points.rules.dailyCap')}</div>
          <div>· {t('points.rules.dedupe')}</div>
        </CardContent>
      </Card>

      {/* 排行榜 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            {t('points.leaderboard.title')}
          </h2>
          <div className="text-xs text-muted-foreground">
            {board ? t('points.leaderboard.totalUsers', { n: board.total_users }) : ''}
          </div>
        </div>
        {loading && !board ? (
          <Card>
            <CardContent className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : board && board.items.length > 0 ? (
          <Card className="overflow-x-auto">
            <Table className="min-w-[420px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{t('points.leaderboard.wallet')}</TableHead>
                  <TableHead className="text-right">{t('points.leaderboard.balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.items.map((it) => (
                  <TableRow key={it.rank}>
                    <TableCell className="text-muted-foreground">
                      {it.rank === 1 && '🥇'}
                      {it.rank === 2 && '🥈'}
                      {it.rank === 3 && '🥉'}
                      {it.rank > 3 && it.rank}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{it.wallet_short}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {it.balance.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t('points.leaderboard.empty')}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function shortAddr(s: string): string {
  return s ? s.slice(0, 4) + '…' + s.slice(-4) : '';
}
