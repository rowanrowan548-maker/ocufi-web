'use client';

/**
 * 邀请仪表盘 /invite
 *
 * V1 内容:
 *  - 我的邀请码 + 一键复制 + 分享 Twitter
 *  - 核心数据(已邀请 / 已激活 / 累计邀请积分)— 后端就绪后接真,目前 mock 0
 *  - 被邀请人列表 — 后端就绪后接,目前 empty state
 *  - 全站邀请 Top 10 — 后端就绪后接,目前 empty state
 *
 * 机制说明区:解释邀请规则 / 激活门槛 / 10% 积分分成
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { Copy, Check, Share2, Wallet, Trophy, Users, Sparkles, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { inviteCodeFor, readCachedMyCode, cacheMyCode, buildInviteUrl } from '@/lib/invite';
import {
  fetchInviteMe, fetchInviteLeaderboard, isApiConfigured,
  type InviteeRow as ApiInviteeRow, type InviteLeaderRow,
} from '@/lib/api-client';
import { toast } from 'sonner';

interface InviteStats {
  invited: number;
  activated: number;
  earnedPoints: number;
}

interface InviteeRow {
  address: string;
  status: 'pending' | 'activated';
  contributedPoints: number;
  joinedAt: number; // ms
}

interface LeaderRow {
  rank: number;
  address: string;
  activated: number;
  points: number;
}

export function InviteScreen() {
  const t = useTranslations('invite');
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [myCode, setMyCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [stats, setStats] = useState<InviteStats>({ invited: 0, activated: 0, earnedPoints: 0 });
  const [invitees, setInvitees] = useState<InviteeRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);

  // 邀请码:先用本地 SHA-256 算出来即时显示,后端 /invite/me 返回更权威值再覆盖
  useEffect(() => {
    if (!wallet.publicKey) { setMyCode(''); return; }
    const addr = wallet.publicKey.toBase58();
    const cached = readCachedMyCode(addr);
    if (cached) { setMyCode(cached); return; }
    inviteCodeFor(addr).then((c) => {
      if (c) { setMyCode(c); cacheMyCode(addr, c); }
    });
  }, [wallet.publicKey]);

  // 拉真实邀请数据(后端在线时)
  useEffect(() => {
    if (!wallet.publicKey || !isApiConfigured()) return;
    const addr = wallet.publicKey.toBase58();
    let cancelled = false;

    fetchInviteMe(addr)
      .then((r) => {
        if (cancelled) return;
        if (r.code) setMyCode(r.code);
        setStats({
          invited: r.invited_count,
          activated: r.activated_count,
          earnedPoints: r.earned_points,
        });
        setInvitees(
          r.invitees.map((row: ApiInviteeRow) => ({
            address: row.address,
            status: row.status,
            contributedPoints: row.contributed_points,
            joinedAt: new Date(row.joined_at).getTime(),
          })),
        );
      })
      .catch((e) => { console.warn('[invite] me failed', e); });

    fetchInviteLeaderboard(10)
      .then((r) => {
        if (cancelled) return;
        setLeaderboard(
          r.items.map((row: InviteLeaderRow) => ({
            rank: row.rank,
            address: row.wallet_short,  // 后端已脱敏
            activated: row.activated,
            points: row.points,
          })),
        );
      })
      .catch((e) => { console.warn('[invite] leaderboard failed', e); });

    return () => { cancelled = true; };
  }, [wallet.publicKey]);

  const inviteUrl = myCode ? buildInviteUrl(myCode) : '';

  async function copyUrl() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败,可手动选择');
    }
  }

  function shareTwitter() {
    if (!inviteUrl) return;
    const text = t('shareText');
    const tweetUrl =
      `https://twitter.com/intent/tweet` +
      `?text=${encodeURIComponent(text + '\n\n')}` +
      `&url=${encodeURIComponent(inviteUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  }

  // 未连钱包
  if (!wallet.connected || !wallet.publicKey) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground" />
            <div className="space-y-1">
              <div className="text-base font-semibold">{t('notConnected.title')}</div>
              <div className="text-xs text-muted-foreground">
                {t('notConnected.subtitle')}
              </div>
            </div>
            <Button onClick={() => openWalletModal(true)}>
              {t('notConnected.connect')}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-5">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
            {t('page.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('page.subtitle')}</p>
        </header>

        {/* 我的邀请码 · 大卡 */}
        <Card className="relative overflow-hidden border-primary/30">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-50 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 0% 0%, oklch(0.88 0.25 155 / 14%), transparent 70%)',
            }}
          />
          <CardContent className="relative p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary/80">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-medium">{t('myCode.label')}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="font-mono text-3xl sm:text-4xl font-bold tracking-widest">
                {myCode || '—'}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground/70 break-all">
                {inviteUrl}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={copyUrl} variant="outline" size="sm" className="flex-1">
                {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? t('myCode.copied') : t('myCode.copy')}
              </Button>
              <Button onClick={shareTwitter} size="sm" className="flex-1">
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                {t('myCode.shareTwitter')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 核心数据 3 栏 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            Icon={Users}
            label={t('stats.invited')}
            value={stats.invited.toString()}
          />
          <StatCard
            Icon={Sparkles}
            label={t('stats.activated')}
            value={stats.activated.toString()}
          />
          <StatCard
            Icon={Trophy}
            label={t('stats.earnedPoints')}
            value={stats.earnedPoints.toLocaleString()}
          />
        </div>

        {/* 机制说明 */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4 text-primary" />
              {t('howItWorks.title')}
            </div>
            <ol className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-4 list-decimal">
              <li>{t('howItWorks.s1')}</li>
              <li>{t('howItWorks.s2')}</li>
              <li>{t('howItWorks.s3')}</li>
              <li>{t('howItWorks.s4')}</li>
            </ol>
            <div className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/40">
              {t('howItWorks.note')}
            </div>
          </CardContent>
        </Card>

        {/* 我邀请的人 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('myInvitees.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invitees.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <div className="font-medium mb-1">{t('myInvitees.empty.title')}</div>
                <div className="text-muted-foreground/70">{t('myInvitees.empty.subtitle')}</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[420px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('myInvitees.cols.address')}</TableHead>
                      <TableHead className="text-right">{t('myInvitees.cols.status')}</TableHead>
                      <TableHead className="text-right">{t('myInvitees.cols.points')}</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">
                        {t('myInvitees.cols.joinedAt')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitees.map((row) => (
                      <TableRow key={row.address}>
                        <TableCell className="font-mono text-xs">
                          {row.address.slice(0, 4)}…{row.address.slice(-4)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              row.status === 'activated'
                                ? 'bg-success/15 text-success'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {row.status === 'activated' ? t('myInvitees.activated') : t('myInvitees.pending')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.contributedPoints > 0 ? `+${row.contributedPoints.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-[10px] text-muted-foreground hidden sm:table-cell">
                          {formatDate(row.joinedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 全站排行 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" />
              {t('leaderboard.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {leaderboard.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground/70">
                {t('leaderboard.empty')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{t('leaderboard.cols.address')}</TableHead>
                    <TableHead className="text-right">{t('leaderboard.cols.activated')}</TableHead>
                    <TableHead className="text-right">{t('leaderboard.cols.points')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((row) => (
                    <TableRow key={row.rank}>
                      <TableCell className="font-mono text-xs">#{row.rank}</TableCell>
                      <TableCell className="font-mono text-xs">{row.address}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{row.activated}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.points.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="text-[10px] text-muted-foreground/70 text-center pt-2">
          {t('backendPending')} ·
          <Link href="/docs" className="ml-1 underline underline-offset-2 hover:text-foreground">
            {t('howLink')}
          </Link>
        </div>
      </div>
    </main>
  );
}

function StatCard({ Icon, label, value }: { Icon: typeof Users; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function formatDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
