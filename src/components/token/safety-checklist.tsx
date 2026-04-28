'use client';

/**
 * T-943 · 12 项安全检查清单
 * 每项 ✅/⚠️/❌ + 原因 · 给单 token 查询页用
 */
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import type { TokenDetail } from '@/lib/token-info';
import { useTranslations } from 'next-intl';

type Status = 'ok' | 'warn' | 'fail' | 'unknown';

interface Check {
  key: string;
  status: Status;
  detail?: string; // 数字/事实补充
}

function check(d: TokenDetail): Check[] {
  const out: Check[] = [];

  // 1. Mint authority
  out.push({
    key: 'mintAuthority',
    status: d.mintActive || d.mintAuthority ? 'fail' : (d.hasGoPlusData || d.hasRugCheckData ? 'ok' : 'unknown'),
  });
  // 2. Freeze authority
  out.push({
    key: 'freezeAuthority',
    status: d.freezeActive || d.freezeAuthority ? 'fail' : (d.hasGoPlusData || d.hasRugCheckData ? 'ok' : 'unknown'),
  });
  // 3. Transfer fee
  const fee = d.transferFeePct ?? 0;
  out.push({
    key: 'transferFee',
    status: fee >= 10 ? 'fail' : fee > 0 ? 'warn' : (d.hasGoPlusData ? 'ok' : 'unknown'),
    detail: fee > 0 ? `${fee.toFixed(2)}%` : undefined,
  });
  // 4. Non-transferable / honeypot
  out.push({
    key: 'nonTransferable',
    status: d.nonTransferable ? 'fail' : (d.hasGoPlusData ? 'ok' : 'unknown'),
  });
  // 5. Balance mutable
  out.push({
    key: 'balanceMutable',
    status: d.balanceMutable ? 'fail' : (d.hasGoPlusData ? 'ok' : 'unknown'),
  });
  // 6. Malicious creator
  out.push({
    key: 'maliciousCreator',
    status: d.maliciousCreator ? 'fail' : (d.hasGoPlusData ? 'ok' : 'unknown'),
  });
  // 7. LP locked
  const lp = d.lpLockedPct ?? null;
  out.push({
    key: 'lpLocked',
    status: lp == null ? 'unknown' : lp < 5 ? 'fail' : lp < 20 ? 'warn' : 'ok',
    detail: lp != null ? `${lp.toFixed(0)}%` : undefined,
  });
  // 8. Top10 concentration
  const top10 = d.top10Pct ?? null;
  out.push({
    key: 'concentration',
    status: top10 == null ? 'unknown' : top10 > 80 ? 'fail' : top10 > 50 ? 'warn' : 'ok',
    detail: top10 != null ? `${top10.toFixed(0)}%` : undefined,
  });
  // 9. Liquidity
  const liq = d.liquidityUsd;
  out.push({
    key: 'liquidity',
    status: !d.hasDexData ? 'unknown' : liq < 10_000 ? 'fail' : liq < 100_000 ? 'warn' : 'ok',
    detail: liq ? `$${formatCompact(liq)}` : undefined,
  });
  // 10. Holders
  const holders = d.totalHolders ?? null;
  out.push({
    key: 'holders',
    status: holders == null ? 'unknown' : holders < 100 ? 'warn' : 'ok',
    detail: holders != null ? holders.toLocaleString() : undefined,
  });
  // 11. Pool age
  const ageMs = d.createdAt ? Date.now() - d.createdAt : null;
  const ageHr = ageMs != null ? ageMs / (60 * 60 * 1000) : null;
  out.push({
    key: 'poolAge',
    status: ageHr == null ? 'unknown' : ageHr < 1 ? 'fail' : ageHr < 24 ? 'warn' : 'ok',
    detail: ageHr != null ? formatAge(ageHr) : undefined,
  });
  // 12. Rugged flag
  out.push({
    key: 'rugged',
    status: d.rugged ? 'fail' : (d.hasRugCheckData ? 'ok' : 'unknown'),
  });

  return out;
}

const ICON_MAP: Record<Status, { Icon: typeof CheckCircle2; color: string }> = {
  ok: { Icon: CheckCircle2, color: 'text-success' },
  warn: { Icon: AlertTriangle, color: 'text-warning' },
  fail: { Icon: XCircle, color: 'text-danger' },
  unknown: { Icon: HelpCircle, color: 'text-muted-foreground' },
};

export function SafetyChecklist({ detail }: { detail: TokenDetail }) {
  const t = useTranslations('token.checks');
  const items = check(detail);
  const okCount = items.filter((i) => i.status === 'ok').length;
  const failCount = items.filter((i) => i.status === 'fail').length;
  const warnCount = items.filter((i) => i.status === 'warn').length;
  const unknownCount = items.filter((i) => i.status === 'unknown').length;

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-3 flex-wrap">
        <span className="text-success">✓ {okCount}</span>
        <span className="text-warning">⚠ {warnCount}</span>
        <span className="text-danger">✗ {failCount}</span>
        {unknownCount > 0 && <span className="text-muted-foreground">? {unknownCount}</span>}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((it) => {
          const { Icon, color } = ICON_MAP[it.status];
          return (
            <li
              key={it.key}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border/40 bg-card/40"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
                <span className="text-xs truncate">{t(`${it.key}.label`)}</span>
              </span>
              <span className={`text-[10px] font-mono whitespace-nowrap ${color}`}>
                {it.detail ?? t(`status.${it.status}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatCompact(n: number): string {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  if (hours < 24 * 30) return `${(hours / 24).toFixed(0)}d`;
  return `${(hours / (24 * 30)).toFixed(0)}mo`;
}
