/**
 * RugCheck.xyz API 封装
 *
 * 免费公开,无需 key。提供:
 * - 持有者分布(前 20)+ 权重占比 + insider 标记
 * - LP 锁定 %
 * - Mint / Freeze Authority 状态
 * - 创建者持仓
 * - 风险项列表(info / warn / danger)
 * - 是否已被判定 rugged
 */

const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';

export type RiskLevel = 'info' | 'warn' | 'danger';

export interface RugCheckRisk {
  name: string;
  value?: string;
  description: string;
  level: RiskLevel;
  score: number;
}

export interface RugCheckHolder {
  address: string;
  owner: string;
  pct: number;
  uiAmountString: string;
  insider: boolean;
}

export interface RugCheckMarket {
  pubkey: string;
  marketType?: string;
  lp?: {
    lpLocked?: number;
    lpUnlocked?: number;
    lpLockedPct?: number;
    lpLockedUSD?: number;
  };
}

export interface RugCheckReport {
  mint: string;
  tokenMeta?: { name?: string; symbol?: string; uri?: string };
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  topHolders?: RugCheckHolder[];
  risks?: RugCheckRisk[];
  score?: number;
  score_normalised?: number;
  totalHolders?: number;
  totalMarketLiquidity?: number;
  totalLPProviders?: number;
  markets?: RugCheckMarket[];
  rugged?: boolean;
  verification?: unknown;
  creator?: string;
  creatorBalance?: number;
  // token.mintAuthority / token.freezeAuthority 早期版本在这下面
  token?: { mintAuthority?: string | null; freezeAuthority?: string | null };
}

/**
 * 查 RugCheck 完整报告
 * 失败返回 null(不抛,让 UI 能降级显示)
 */
export async function fetchRugCheckReport(
  mint: string
): Promise<RugCheckReport | null> {
  try {
    const res = await fetch(`${RUGCHECK_BASE}/tokens/${mint}/report`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[rugcheck] ${mint.slice(0, 8)}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as RugCheckReport;
  } catch (e) {
    console.warn(`[rugcheck] ${mint.slice(0, 8)}:`, e);
    return null;
  }
}

/** 归一化的 authority getter(不管字段在 token.* 还是 顶层) */
export function getMintAuthority(r: RugCheckReport): string | null {
  return r.token?.mintAuthority ?? r.mintAuthority ?? null;
}
export function getFreezeAuthority(r: RugCheckReport): string | null {
  return r.token?.freezeAuthority ?? r.freezeAuthority ?? null;
}

/** 前 N 持仓 % 之和 */
export function top10Pct(r: RugCheckReport): number {
  const hs = r.topHolders ?? [];
  return hs.slice(0, 10).reduce((s, h) => s + (h.pct ?? 0), 0);
}

/** 最主池子的 LP 锁定 %(把所有 pool 取最大;没有则 0) */
export function bestLpLockedPct(r: RugCheckReport): number {
  const ms = r.markets ?? [];
  let best = 0;
  for (const m of ms) {
    const p = m.lp?.lpLockedPct ?? 0;
    if (p > best) best = p;
  }
  return best;
}
