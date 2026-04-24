/**
 * 合 DexScreener + RugCheck,为代币详情页准备完整数据
 * 两个源并行拉,任一失败用 null 降级显示
 */
import { fetchTokenInfo as fetchDexInfo, type TokenInfo as DexTokenInfo } from './portfolio';
import {
  fetchRugCheckReport,
  getMintAuthority,
  getFreezeAuthority,
  top10Pct,
  bestLpLockedPct,
  type RugCheckReport,
  type RugCheckHolder,
  type RugCheckRisk,
} from './rugcheck';
import { isVerifiedToken } from './verified-tokens';

export interface TokenDetail {
  mint: string;
  symbol: string;
  name: string;
  logoUri?: string;
  // 价格/市场
  priceUsd: number;
  priceNative: number;
  priceChange24h?: number;
  marketCap: number;
  liquidityUsd: number;
  volume24h?: number;
  buys24h?: number;
  sells24h?: number;
  createdAt?: number;      // pair 创建 ms timestamp
  dexUrl?: string;
  // 安全
  mintAuthority: string | null;
  freezeAuthority: string | null;
  top10Pct: number | null;        // 前 10 持仓 %
  totalHolders: number | null;
  lpLockedPct: number | null;
  rugged: boolean | null;
  scoreNormalised: number | null;
  creatorBalance: number | null;
  // 原始
  risks: RugCheckRisk[];
  topHolders: RugCheckHolder[];
  // 数据源可用性
  hasDexData: boolean;
  hasRugCheckData: boolean;
}

export async function fetchTokenDetail(mint: string): Promise<TokenDetail> {
  const [dex, rug] = await Promise.all([
    fetchDexInfo(mint),
    fetchRugCheckReport(mint),
  ]);

  const d: DexTokenInfo | null = dex;
  const r: RugCheckReport | null = rug;

  // 从 DexScreener 的 response 直接找出 priceChange / volume / txns / pairCreatedAt
  // 这些在 portfolio.ts 的 fetchTokenInfo 里没取,我再抓一次 raw
  let priceChange24h: number | undefined;
  let volume24h: number | undefined;
  let buys24h: number | undefined;
  let sells24h: number | undefined;
  let createdAt: number | undefined;
  let dexUrl: string | undefined;
  if (d) {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const json = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pairs: any[] = (json?.pairs ?? []).filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p?.chainId === 'solana' && p?.baseToken?.address === mint
        );
        pairs.sort(
          (a, b) =>
            Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
        );
        const top = pairs[0];
        if (top) {
          priceChange24h = Number(top?.priceChange?.h24 ?? 0);
          volume24h = Number(top?.volume?.h24 ?? 0);
          buys24h = Number(top?.txns?.h24?.buys ?? 0);
          sells24h = Number(top?.txns?.h24?.sells ?? 0);
          createdAt = top?.pairCreatedAt
            ? Number(top.pairCreatedAt)
            : undefined;
          dexUrl = top?.url;
        }
      }
    } catch {
      /* best-effort */
    }
  }

  // 合并
  const detail: TokenDetail = {
    mint,
    symbol: d?.symbol ?? r?.tokenMeta?.symbol ?? mint.slice(0, 6),
    name: d?.name ?? r?.tokenMeta?.name ?? '',
    logoUri: d?.logoUri,
    priceUsd: d?.priceUsd ?? 0,
    priceNative: d?.priceNative ?? 0,
    priceChange24h,
    marketCap: d?.marketCap ?? 0,
    liquidityUsd: d?.liquidityUsd ?? r?.totalMarketLiquidity ?? 0,
    volume24h,
    buys24h,
    sells24h,
    createdAt,
    dexUrl,
    mintAuthority: r ? getMintAuthority(r) : null,
    freezeAuthority: r ? getFreezeAuthority(r) : null,
    top10Pct: r ? top10Pct(r) : null,
    totalHolders: r?.totalHolders ?? null,
    lpLockedPct: r ? bestLpLockedPct(r) : null,
    rugged: r?.rugged ?? null,
    scoreNormalised: r?.score_normalised ?? null,
    creatorBalance: r?.creatorBalance ?? null,
    risks: r?.risks ?? [],
    topHolders: r?.topHolders ?? [],
    hasDexData: !!d,
    hasRugCheckData: !!r,
  };

  return detail;
}

// ────── 风险综合评级 ──────
export type OverallRisk = 'verified' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export function overallRisk(d: TokenDetail): OverallRisk {
  // 白名单:主流稳定币/蓝筹,通用规则对它们过严(USDC 必须保留 mint 权限等)
  if (isVerifiedToken(d.mint)) return 'verified';

  if (!d.hasRugCheckData) return 'unknown';
  if (d.rugged) return 'critical';
  const dangers = d.risks.filter((r) => r.level === 'danger').length;
  const warns = d.risks.filter((r) => r.level === 'warn').length;
  const top10 = d.top10Pct ?? 0;
  const lpLocked = d.lpLockedPct ?? 0;

  if (dangers > 0) return 'critical';
  if (d.mintAuthority || d.freezeAuthority) return 'high';
  if (top10 > 80 || lpLocked < 20) return 'high';
  if (warns >= 2 || top10 > 50 || lpLocked < 70) return 'medium';
  return 'low';
}
