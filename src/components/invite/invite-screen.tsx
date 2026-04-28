'use client';

/**
 * 邀请仪表盘 /invite
 *
 * T-941 升级:
 *  - #110 邀请码 v2 8 字符大写(lib/invite.ts 已升 + maxLength 8)
 *  - #111 分享 Dialog(Twitter / TG / QR / 复制)
 *  - #112 数字卡:已邀请 N 人 / 累计返佣 X SOL ($Y) / 待提现 X SOL [一键提现]
 *  - #113 下线列表:钱包(截断)/ 加入时间 / 累计贡献(SOL)/ 状态
 *  - #114 一键提现按钮 → POST /invite/claim
 *  - #115 Twitter 预制推文已含 Ocufi_io @ + 0.2% + ref code
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { Copy, Check, Wallet, Trophy, Users, Sparkles, Info, Coins, ArrowDownToLine, Zap, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { inviteCodeFor, readCachedMyCode, cacheMyCode, buildInviteUrl } from '@/lib/invite';
import {
  fetchInviteMe, fetchInviteLeaderboard, claimInviteRebate, regenerateInviteCode, isApiConfigured,
  type InviteeRow as ApiInviteeRow, type InviteLeaderRow, type RebateSummary,
} from '@/lib/api-client';
import { toast } from 'sonner';
import { ShareDialog } from './share-dialog';
import { DownstreamList } from './downstream-list';

interface InviteeRow {
  address: string;
  addressShort: string;
  status: 'pending' | 'activated';
  contributedPoints: number;
  joinedAt: number; // ms
  level: number;
}

interface LeaderRow {
  rank: number;
  address: string;
  activated: number;
  points: number;
}

const EMPTY_REBATE: RebateSummary = {
  inviteCount: 0,
  activatedCount: 0,
  totalRebatePoints: 0,
  totalRebateSol: 0,
  totalRebateUsd: 0,
  claimableSol: 0,
  pendingClaimSol: 0,
};

// 后端 1_000_000 points ≈ 1 SOL · 与 ocufi-api/services 同步
const REBATE_SOL_PER_POINT = 1 / 1_000_000;

export function InviteScreen() {
  const t = useTranslations('invite');
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [myCode, setMyCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [rebate, setRebate] = useState<RebateSummary>(EMPTY_REBATE);
  const [invitees, setInvitees] = useState<InviteeRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [claiming, setClaiming] = useState(false);
  // T-975 · v1 → v2 升级
  const [regenerating, setRegenerating] = useState(false);

  // 邀请码:先用本地 SHA-256 算出来即时显示(v2 8 字符),后端 /invite/me 返回更权威值再覆盖
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
        setRebate(r.rebate ?? {
          ...EMPTY_REBATE,
          inviteCount: r.invited_count,
          activatedCount: r.activated_count,
          totalRebatePoints: r.earned_points,
          totalRebateSol: r.earned_points * REBATE_SOL_PER_POINT,
        });
        setInvitees(
          r.invitees.map((row: ApiInviteeRow) => ({
            address: row.address,
            addressShort: row.address_short || `${row.address.slice(0, 4)}…${row.address.slice(-4)}`,
            status: row.status,
            contributedPoints: row.contributed_points,
            joinedAt: new Date(row.joined_at).getTime(),
            level: row.level ?? 1,
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
            address: row.wallet_short,
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
      toast.error(t('copyFailed'));
    }
  }

  // T-941 #114 · 一键提现
  async function handleClaim() {
    if (!wallet.publicKey || claiming) return;
    if (rebate.claimableSol <= 0) {
      toast.error(t('claim.nothingToClaim'));
      return;
    }
    setClaiming(true);
    try {
      const r = await claimInviteRebate(wallet.publicKey.toBase58());
      if (r.ok) {
        toast.success(t('claim.success', { sol: r.amount_sol?.toFixed(4) ?? '0' }));
        // 乐观刷新:claimableSol → 0,pendingClaimSol += amt
        setRebate((p) => ({
          ...p,
          claimableSol: 0,
          pendingClaimSol: p.pendingClaimSol + (r.amount_sol ?? 0),
        }));
      } else {
        const reason = r.error ?? 'unknown';
        toast.error(t('claim.failed', { reason }));
      }
    } catch (e) {
      console.warn('[invite] claim failed', e);
      toast.error(t('claim.failed', { reason: 'network' }));
    } finally {
      setClaiming(false);
    }
  }

  // T-975 · v1(6 字符)→ v2(8 字符)升级
  async function handleRegenerate() {
    if (!wallet.publicKey || regenerating) return;
    setRegenerating(true);
    try {
      const r = await regenerateInviteCode(wallet.publicKey.toBase58());
      if (r.ok && r.code) {
        if (r.upgraded) {
          setMyCode(r.code);
          cacheMyCode(wallet.publicKey.toBase58(), r.code);
          toast.success(t('regenerate.success', { code: r.code }));
        } else if (r.already_v2) {
          toast.info(t('regenerate.alreadyV2'));
        }
      } else {
        const reason = r.error ?? 'unknown';
        toast.error(t('regenerate.failed', { reason }));
      }
    } catch (e) {
      console.warn('[invite] regenerate failed', e);
      toast.error(t('regenerate.failed', { reason: 'network' }));
    } finally {
      setRegenerating(false);
    }
  }

  // T-974 BUG-039 · 未连钱包教育态:dummy 数字卡 + 分享按钮 disabled tooltip + 推文模板 placeholder
  const notConnected = !wallet.connected || !wallet.publicKey;
  // T-975 · v1 = 6 字符 · v2 = 8 字符
  const isV1Code = !notConnected && myCode.length === 6;

  return (
    <main className="flex flex-1 flex-col">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-5">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
            {t('page.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('page.subtitle')}</p>
        </header>

        {/* T-974 BUG-039 · 未连钱包教育态 banner */}
        {notConnected && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1 text-sm">
                <div className="font-medium">{t('notConnected.title')}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {t('notConnected.educational')}
                </div>
              </div>
              <Button size="sm" onClick={() => openWalletModal(true)}>
                {t('notConnected.connect')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* T-975 · v1 老用户(6 字符)升级 v2(8 字符)banner */}
        {isV1Code && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="py-4 flex items-center gap-3">
              <Zap className="h-5 w-5 text-warning flex-shrink-0" />
              <div className="flex-1 text-sm">
                <div className="font-medium">{t('regenerate.title')}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {t('regenerate.subtitle', { current: myCode })}
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="bg-warning hover:bg-warning/90 text-warning-foreground"
              >
                {regenerating ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t('regenerate.processing')}</>
                ) : t('regenerate.button')}
              </Button>
            </CardContent>
          </Card>
        )}

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
              {/* T-941 #110 · v2 8 字符大写 · T-974 BUG-039 未连钱包占位 ABCD1234 */}
              <div className={`font-mono text-3xl sm:text-4xl font-bold tracking-widest ${notConnected ? 'text-muted-foreground/40' : ''}`}>
                {notConnected ? 'ABCD1234' : (myCode || '—')}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground/70 break-all">
                {notConnected ? buildInviteUrl('ABCD1234') : inviteUrl}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={copyUrl}
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={notConnected}
                title={notConnected ? t('notConnected.shareTooltip') : undefined}
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? t('myCode.copied') : t('myCode.copy')}
              </Button>
              {/* T-941 #111 · 分享 Dialog · T-974 BUG-039 未连钱包用 disabled placeholder 替代 */}
              {notConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title={t('notConnected.shareTooltip')}
                >
                  {t('myCode.share')}
                </Button>
              ) : (
                <ShareDialog inviteUrl={inviteUrl} code={myCode} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* T-941 #112 · 3 数字卡:已邀请 / 累计返佣 / 待提现 + 一键提现 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            Icon={Users}
            label={t('stats.invitedLabel')}
            value={t('stats.invitedValue', { n: rebate.inviteCount })}
            sub={t('stats.activatedSub', { n: rebate.activatedCount })}
          />
          <StatCard
            Icon={Coins}
            label={t('stats.rebateLabel')}
            value={`${rebate.totalRebateSol.toFixed(4)} SOL`}
            sub={`≈ $${rebate.totalRebateUsd.toFixed(2)}`}
          />
          {/* 待提现 + 一键提现按钮 */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <ArrowDownToLine className="h-3 w-3" />
                {t('stats.claimableLabel')}
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums">
                {rebate.claimableSol.toFixed(4)} SOL
              </div>
              {rebate.pendingClaimSol > 0 && (
                <div className="text-[10px] text-warning">
                  {t('stats.pendingSub', { sol: rebate.pendingClaimSol.toFixed(4) })}
                </div>
              )}
              <Button
                onClick={handleClaim}
                size="sm"
                disabled={notConnected || claiming || rebate.claimableSol < 0.001}
                title={notConnected ? t('notConnected.shareTooltip') : undefined}
                className="w-full h-8 text-xs"
              >
                {claiming ? t('claim.processing') : t('claim.button')}
              </Button>
            </CardContent>
          </Card>
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

        {/* T-941 #113 · 我邀请的人(钱包/加入时间/累计贡献 SOL/状态)*/}
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
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('myInvitees.cols.address')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('myInvitees.cols.joinedAt')}</TableHead>
                      <TableHead className="text-right">{t('myInvitees.cols.contributedSol')}</TableHead>
                      <TableHead className="text-right">{t('myInvitees.cols.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitees.map((row) => {
                      const sol = row.contributedPoints * REBATE_SOL_PER_POINT;
                      return (
                        <TableRow key={row.address}>
                          <TableCell className="font-mono text-xs">
                            {row.addressShort}
                            {row.level > 1 && (
                              <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground/70">
                                L{row.level}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-[10px] text-muted-foreground">
                            {formatDate(row.joinedAt)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {sol > 0 ? `${sol.toFixed(4)}` : '—'}
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* T-INV-113 · 我的下线列表 */}
        <DownstreamList />

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

function StatCard({
  Icon, label, value, sub,
}: {
  Icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
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
