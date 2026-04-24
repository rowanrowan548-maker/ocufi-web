'use client';

/**
 * 代币详情页主 UI
 * 拿 mint,调 fetchTokenDetail,渲染 Hero + 核心数据 + 安全核查 + 风险明细 + 前10持有者 + 动作按钮
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import {
  ExternalLink, Copy, Check, ShoppingCart, Shield, AlertTriangle,
  CheckCircle2, XCircle, Clock, Users, BarChart3, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableRow,
} from '@/components/ui/table';
import {
  fetchTokenDetail, overallRisk, type TokenDetail, type OverallRisk,
} from '@/lib/token-info';
import { getCurrentChain } from '@/config/chains';
import { RiskBadge } from './risk-badge';
import { track } from '@/lib/analytics';

interface Props {
  mint: string;
}

export function TokenDetailView({ mint }: Props) {
  const t = useTranslations();
  const chain = getCurrentChain();

  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    fetchTokenDetail(mint).then((d) => {
      if (cancelled) return;
      setDetail(d);
      track('token_safety_view', {
        mint,
        symbol: d?.symbol,
        risk: d ? overallRisk(d) : 'unknown',
      });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mint]);

  const copyMint = async () => {
    try {
      await navigator.clipboard.writeText(mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="py-16 text-center text-muted-foreground">
          {t('token.notFound')}
        </CardContent>
      </Card>
    );
  }

  const risk: OverallRisk = overallRisk(detail);
  const ageHours =
    detail.createdAt
      ? (Date.now() - detail.createdAt) / (1000 * 60 * 60)
      : null;

  return (
    <div className="w-full max-w-5xl space-y-4">
      {/* ── Hero ── gmgn 风:大字价格 + 青绿光晕 */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 0% 0%, oklch(0.88 0.25 155 / 10%), transparent 70%)',
          }}
        />
        <CardContent className="p-6 relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-1 ring-border/40">
                {detail.logoUri ? (
                  <Image
                    src={detail.logoUri}
                    alt={detail.symbol}
                    width={64}
                    height={64}
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">
                    {detail.symbol.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{detail.symbol}</h1>
                  {detail.name && detail.name !== detail.symbol && (
                    <span className="text-muted-foreground text-sm">· {detail.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {shortAddr(mint)}
                  </span>
                  <button
                    onClick={copyMint}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title={t('wallet.copyAddress')}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight">
                    ${fmtPrice(detail.priceUsd)}
                  </span>
                  {detail.priceChange24h !== undefined && (
                    <span
                      className={[
                        'text-sm font-mono font-medium',
                        detail.priceChange24h >= 0 ? 'text-success' : 'text-danger',
                      ].join(' ')}
                    >
                      {detail.priceChange24h >= 0 ? '+' : ''}
                      {detail.priceChange24h.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            <RiskBadge
              level={risk}
              label={t(`token.risk.${risk}`)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── K 线图(嵌入 DexScreener,V1.5 自绘) ── */}
      {detail.dexUrl && (
        <Card className="overflow-hidden p-0">
          <iframe
            src={`${detail.dexUrl}?embed=1&theme=dark&trades=0&info=0`}
            className="w-full h-[420px] sm:h-[480px] border-0"
            title={`${detail.symbol} chart`}
            loading="lazy"
          />
        </Card>
      )}

      {/* ── 两列:核心数据 + 安全核查 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('token.marketData')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatRow label={t('token.marketCap')} value={`$${fmtUsd(detail.marketCap)}`} />
            <StatRow
              label={t('token.liquidity')}
              value={`$${fmtUsd(detail.liquidityUsd)}`}
              warn={detail.liquidityUsd > 0 && detail.liquidityUsd < 50_000}
            />
            {detail.volume24h !== undefined && (
              <StatRow label={t('token.volume24h')} value={`$${fmtUsd(detail.volume24h)}`} />
            )}
            {detail.buys24h !== undefined && detail.sells24h !== undefined && (
              <StatRow
                label={t('token.buys24h')}
                value={`${detail.buys24h} / ${detail.sells24h}`}
              />
            )}
            <StatRow
              label={t('token.createdAt')}
              value={formatAge(ageHours, t)}
              warn={ageHours !== null && ageHours < 24}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t('token.safetyChecks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CheckRow
              label={t('token.mintAuthority')}
              status={
                !detail.hasRugCheckData ? 'unknown' :
                detail.mintAuthority === null ? 'pass' : 'fail'
              }
              passText={t('token.status.renounced')}
              failText={t('token.status.active')}
            />
            <CheckRow
              label={t('token.freezeAuthority')}
              status={
                !detail.hasRugCheckData ? 'unknown' :
                detail.freezeAuthority === null ? 'pass' : 'fail'
              }
              passText={t('token.status.renounced')}
              failText={t('token.status.active')}
            />
            <CheckRow
              label={t('token.top10Holders')}
              status={
                detail.top10Pct === null ? 'unknown' :
                detail.top10Pct > 80 ? 'fail' :
                detail.top10Pct > 50 ? 'warn' : 'pass'
              }
              passText={detail.top10Pct !== null ? `${detail.top10Pct.toFixed(1)}%` : '—'}
              failText={detail.top10Pct !== null ? `${detail.top10Pct.toFixed(1)}%` : '—'}
              warnText={detail.top10Pct !== null ? `${detail.top10Pct.toFixed(1)}%` : '—'}
            />
            <CheckRow
              label={t('token.lpLocked')}
              status={
                detail.lpLockedPct === null ? 'unknown' :
                detail.lpLockedPct >= 70 ? 'pass' :
                detail.lpLockedPct >= 20 ? 'warn' : 'fail'
              }
              passText={detail.lpLockedPct !== null ? `${detail.lpLockedPct.toFixed(1)}%` : '—'}
              warnText={detail.lpLockedPct !== null ? `${detail.lpLockedPct.toFixed(1)}%` : '—'}
              failText={detail.lpLockedPct !== null ? `${detail.lpLockedPct.toFixed(1)}%` : '—'}
            />
            {detail.totalHolders !== null && (
              <StatRow
                label={t('token.totalHolders')}
                value={detail.totalHolders.toLocaleString()}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── verified 代币说明 ── */}
      {risk === 'verified' && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 text-sm flex gap-3">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-muted-foreground">{t('token.verifiedNote')}</div>
          </CardContent>
        </Card>
      )}

      {/* ── 风险明细 ── */}
      {detail.risks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t('token.riskDetails')} ({detail.risks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.risks.map((r, i) => (
              <div
                key={i}
                className={[
                  'flex gap-3 p-3 rounded-md text-sm',
                  r.level === 'danger'
                    ? 'bg-danger/10 text-danger border border-danger/20'
                    : r.level === 'warn'
                    ? 'bg-warning/10 text-warning border border-warning/20'
                    : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">{r.name}</div>
                  {r.description && (
                    <div className="text-xs mt-1 opacity-90">{r.description}</div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 前 10 持有者 ── */}
      {detail.topHolders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('token.topHolders')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {detail.topHolders.slice(0, 10).map((h, i) => (
                  <TableRow key={h.address}>
                    <TableCell className="w-10 text-muted-foreground text-xs">
                      #{i + 1}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <a
                          href={`${chain.explorer}/account/${h.owner || h.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {shortAddr(h.owner || h.address)}
                        </a>
                        {h.insider && (
                          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-[10px] rounded">
                            insider
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {h.pct.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── 动作按钮 ── */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link href={`/trade?mint=${mint}`}>
          <Button size="lg">
            <ShoppingCart className="mr-2 h-4 w-4" />
            {t('token.actions.buy')}
          </Button>
        </Link>
        {detail.dexUrl && (
          <a href={detail.dexUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              DexScreener
            </Button>
          </a>
        )}
        <a
          href={`https://rugcheck.xyz/tokens/${mint}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" variant="outline">
            <Shield className="mr-2 h-4 w-4" />
            RugCheck
          </Button>
        </a>
        <a
          href={`${chain.explorer}/token/${mint}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            Solscan
          </Button>
        </a>
      </div>

      {!detail.hasRugCheckData && (
        <p className="text-xs text-muted-foreground text-center">
          {t('token.rugCheckUnavailable')}
        </p>
      )}
    </div>
  );
}

// ───── 小组件 ─────
function StatRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={[
          'font-mono text-sm',
          warn ? 'text-orange-500 font-medium' : '',
        ].join(' ')}
      >
        {value}
        {warn && <AlertTriangle className="inline h-3 w-3 ml-1" />}
      </span>
    </div>
  );
}

type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';

function CheckRow({
  label,
  status,
  passText,
  warnText,
  failText,
}: {
  label: string;
  status: CheckStatus;
  passText: string;
  warnText?: string;
  failText: string;
}) {
  const map: Record<
    CheckStatus,
    { Icon: typeof CheckCircle2; text: string; cls: string }
  > = {
    pass: { Icon: CheckCircle2, text: passText, cls: 'text-success' },
    warn: { Icon: AlertTriangle, text: warnText ?? passText, cls: 'text-warning' },
    fail: { Icon: XCircle, text: failText, cls: 'text-danger' },
    unknown: { Icon: Clock, text: '—', cls: 'text-muted-foreground' },
  };
  const { Icon, text, cls } = map[status];
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={['flex items-center gap-1.5 font-mono text-sm', cls].join(' ')}>
        <Icon className="h-3.5 w-3.5" />
        {text}
      </span>
    </div>
  );
}

// ───── 工具 ─────
function shortAddr(s: string) {
  return s ? s.slice(0, 4) + '…' + s.slice(-4) : '';
}

function fmtPrice(n: number): string {
  if (!n && n !== 0) return '—';
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  if (n === 0) return '0';
  return n.toFixed(9);
}

function fmtUsd(n: number): string {
  if (!n && n !== 0) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

function formatAge(
  hours: number | null,
  t: ReturnType<typeof useTranslations>
): string {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} ${t('token.age.minutes')}`;
  if (hours < 24) return `${hours.toFixed(1)} ${t('token.age.hours')}`;
  const days = hours / 24;
  if (days < 30) return `${days.toFixed(1)} ${t('token.age.days')}`;
  const months = days / 30;
  if (months < 12) return `${months.toFixed(1)} ${t('token.age.months')}`;
  return `${(months / 12).toFixed(1)} ${t('token.age.years')}`;
}
