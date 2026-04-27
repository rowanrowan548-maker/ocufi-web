/**
 * 合 DexScreener + RugCheck + GoPlus,为代币详情页准备完整数据
 * 三个源并行拉,任一失败用 null 降级显示
 *
 * 风险评级 fail-safe 原则:
 *  - 两源都失败 → unknown(UI 强制勾选,不静默放行)
 *  - 任一源标记蜜罐 / rugged / 不可转 / 高转账税 → critical(不豁免)
 *  - 新币 < 1h / 流动性 < $10K → critical 硬阻断
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
import {
  fetchGoPlusReport,
  transferFeePct as goPlusTransferFeePct,
  isNonTransferable as goPlusIsNonTransferable,
  isMintActive as goPlusIsMintActive,
  isFreezeActive as goPlusIsFreezeActive,
  isBalanceMutable as goPlusIsBalanceMutable,
  hasMaliciousCreator as goPlusHasMaliciousCreator,
  isGoPlusTrusted,
} from './goplus';
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
  // 安全 · RugCheck
  mintAuthority: string | null;
  freezeAuthority: string | null;
  top10Pct: number | null;        // 前 10 持仓 %
  totalHolders: number | null;
  lpLockedPct: number | null;
  rugged: boolean | null;
  scoreNormalised: number | null;
  creatorBalance: number | null;
  // 安全 · GoPlus(蜜罐 / 转账税 / 二次验证)
  transferFeePct: number | null;       // 转账税 %(0~100)
  nonTransferable: boolean | null;     // 不可转(蜜罐核心特征)
  mintActive: boolean | null;          // GoPlus 视角:增发权未放弃
  freezeActive: boolean | null;        // GoPlus 视角:冻结权未放弃
  balanceMutable: boolean | null;      // 余额可被外部修改(超危险)
  maliciousCreator: boolean | null;    // 创建者被 GoPlus 标恶意
  goPlusTrusted: boolean | null;       // GoPlus 白名单
  // 原始
  risks: RugCheckRisk[];
  topHolders: RugCheckHolder[];
  // 数据源可用性
  hasDexData: boolean;
  hasRugCheckData: boolean;
  hasGoPlusData: boolean;
}

// 详情缓存 30s,trade 页频繁切代币也不重打 RugCheck / DexScreener / GoPlus
const detailCache = new Map<string, { data: TokenDetail; expiresAt: number }>();
const DETAIL_TTL_MS = 30_000;
const detailInflight = new Map<string, Promise<TokenDetail>>();

export async function fetchTokenDetail(mint: string): Promise<TokenDetail> {
  const cached = detailCache.get(mint);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const existing = detailInflight.get(mint);
  if (existing) return existing;

  const promise = doFetchTokenDetail(mint).then((detail) => {
    detailCache.set(mint, { data: detail, expiresAt: Date.now() + DETAIL_TTL_MS });
    detailInflight.delete(mint);
    return detail;
  }).catch((err) => {
    detailInflight.delete(mint);
    // 失败时复用旧缓存(限速期间不让 UI 空白)
    if (cached) return cached.data;
    throw err;
  });

  detailInflight.set(mint, promise);
  return promise;
}

async function doFetchTokenDetail(mint: string): Promise<TokenDetail> {
  const [dex, rug, gp] = await Promise.all([
    fetchDexInfo(mint),
    fetchRugCheckReport(mint),
    fetchGoPlusReport(mint),
  ]);

  const d: DexTokenInfo | null = dex;
  const r: RugCheckReport | null = rug;

  // T-705b:之前这里 fetch DexScreener `/latest/dex/tokens/${mint}` 与上面 fetchDexInfo(=portfolio.fetchTokenInfo)
  // 1:1 重复请求(都打同一 DexScreener endpoint),只为多拿 buys24h / sells24h / dexUrl 三个字段。
  //   - priceChange24h / volume24h / createdAt → d 已经有(直接用 d 的字段)
  //   - buys24h / sells24h → 后端 /token/info 代理(GT)token-level 也不给(只在 pool-level 才有),
  //     如果以后真要,要么改 portfolio.ts 暴露 txns 字段,要么后端代理增强;暂时 undefined,
  //     info-panel buys/sells row 已 null-guard,优雅降级。
  //   - dexUrl 前端 grep 无引用,可弃。
  // 直接复用 d 字段,移除冗余 fetch · 去重一次 DexScreener 直击。
  const priceChange24h = d?.priceChange24h;
  const volume24h = d?.volume24h;
  const buys24h: number | undefined = undefined;
  const sells24h: number | undefined = undefined;
  const createdAt = d?.pairCreatedAt;
  const dexUrl: string | undefined = undefined;

  const detail: TokenDetail = {
    mint,
    symbol: d?.symbol ?? r?.tokenMeta?.symbol ?? gp?.metadata?.symbol ?? mint.slice(0, 6),
    name: d?.name ?? r?.tokenMeta?.name ?? gp?.metadata?.name ?? '',
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
    // GoPlus 派生
    transferFeePct: gp ? goPlusTransferFeePct(gp) : null,
    nonTransferable: gp ? goPlusIsNonTransferable(gp) : null,
    mintActive: gp ? goPlusIsMintActive(gp) : null,
    freezeActive: gp ? goPlusIsFreezeActive(gp) : null,
    balanceMutable: gp ? goPlusIsBalanceMutable(gp) : null,
    maliciousCreator: gp ? goPlusHasMaliciousCreator(gp) : null,
    goPlusTrusted: gp ? isGoPlusTrusted(gp) : null,
    risks: r?.risks ?? [],
    topHolders: r?.topHolders ?? [],
    hasDexData: !!d,
    hasRugCheckData: !!r,
    hasGoPlusData: !!gp,
  };

  return detail;
}

// ────── 风险综合评级 ──────
export type OverallRisk = 'verified' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';

/**
 * 触发某条 critical 的具体原因(供红弹窗逐条展示)
 */
export interface RiskReason {
  code: string;       // 机器码,前端 i18n
  severity: 'critical' | 'high' | 'medium';
  source: 'rugcheck' | 'goplus' | 'dex' | 'self';
}

/**
 * 综合风险评分(fail-safe 版)
 *
 * 评分顺序:
 *  1. 白名单(双源任一标 verified)→ verified
 *  2. 硬阻断(critical):蜜罐 / rugged / 不可转 / 转账税 ≥10% / 创建者恶意 / 新币 <1h / 流动性 <$10K
 *  3. 两源都失败 → unknown(UI 强制勾选,不静默放行)
 *  4. 通用评级:综合 RugCheck dangers + GoPlus 权限 + 持仓集中度 + LP 锁定
 */
export function overallRisk(d: TokenDetail): OverallRisk {
  // ── 白名单 ──
  if (isVerifiedToken(d.mint)) return 'verified';
  if (d.goPlusTrusted) return 'verified';

  // ── 硬阻断 critical(任一命中即升级,不豁免) ──
  if (d.rugged) return 'critical';
  if (d.nonTransferable) return 'critical';                   // 蜜罐核心特征
  if (d.maliciousCreator) return 'critical';                  // 创建者被标恶意
  if (d.balanceMutable) return 'critical';                    // 余额可被外部修改
  if ((d.transferFeePct ?? 0) >= 10) return 'critical';       // 转账税 ≥10% 视为蜜罐
  if (d.hasDexData && (d.liquidityUsd ?? 0) < 10_000) return 'critical'; // 流动性极低
  if (d.createdAt && Date.now() - d.createdAt < 60 * 60 * 1000) return 'critical'; // <1h 新币

  // ── 数据完全缺失 → unknown(强制勾选) ──
  if (!d.hasRugCheckData && !d.hasGoPlusData) return 'unknown';

  // ── 通用评级 ──
  const dangers = d.risks.filter((r) => r.level === 'danger').length;
  const warns = d.risks.filter((r) => r.level === 'warn').length;
  const top10 = d.top10Pct ?? 0;
  const lpLocked = d.lpLockedPct ?? 0;
  const transferFee = d.transferFeePct ?? 0;
  // GoPlus 权限维度:任一权限活跃就计 1 分
  const goPlusAuthorityCount =
    (d.mintActive ? 1 : 0) +
    (d.freezeActive ? 1 : 0);

  const isHighCap = (d.marketCap ?? 0) >= 50_000_000;
  const isHighLiq = (d.liquidityUsd ?? 0) >= 1_000_000;
  const isHighProfile = isHighCap || isHighLiq;

  // critical(非硬阻断):多重 danger / 低 LP / 高转账税 +1
  if (dangers >= 3) return 'critical';
  if (dangers >= 2 && !isHighProfile) return 'critical';
  if (lpLocked < 5 && !isHighProfile && d.hasRugCheckData) return 'critical';
  if (transferFee >= 5 && !isHighProfile) return 'critical';

  // 24h 内新币 → 至少 high
  if (d.createdAt && Date.now() - d.createdAt < 24 * 60 * 60 * 1000) return 'high';

  // high
  if (dangers >= 1 && !isHighProfile) return 'high';
  if (top10 > 80 || (lpLocked < 20 && d.hasRugCheckData)) return 'high';
  if (goPlusAuthorityCount >= 2 && !isHighProfile) return 'high';
  if ((d.mintAuthority || d.freezeAuthority) && !isHighProfile) return 'high';
  if (transferFee > 0 && !isHighProfile) return 'high';

  // medium
  if (dangers >= 1 || warns >= 2 || top10 > 50 || (lpLocked < 70 && d.hasRugCheckData)) return 'medium';
  if (goPlusAuthorityCount >= 1) return 'medium';
  return 'low';
}

/**
 * 列出导致风险升级的具体原因,给 UI 红弹窗逐条展示
 * 返回的 code 对应 i18n key:trade.confirm.highRisk.reasons.<code>
 */
export function riskReasons(d: TokenDetail): RiskReason[] {
  const out: RiskReason[] = [];

  if (d.rugged) out.push({ code: 'rugged', severity: 'critical', source: 'rugcheck' });
  if (d.nonTransferable) out.push({ code: 'nonTransferable', severity: 'critical', source: 'goplus' });
  if (d.maliciousCreator) out.push({ code: 'maliciousCreator', severity: 'critical', source: 'goplus' });
  if (d.balanceMutable) out.push({ code: 'balanceMutable', severity: 'critical', source: 'goplus' });
  if ((d.transferFeePct ?? 0) >= 10) {
    out.push({ code: 'highTransferFee', severity: 'critical', source: 'goplus' });
  } else if ((d.transferFeePct ?? 0) > 0) {
    out.push({ code: 'transferFee', severity: 'high', source: 'goplus' });
  }
  if (d.hasDexData && (d.liquidityUsd ?? 0) < 10_000) {
    out.push({ code: 'lowLiquidity', severity: 'critical', source: 'dex' });
  }
  if (d.createdAt) {
    const ageMs = Date.now() - d.createdAt;
    if (ageMs < 60 * 60 * 1000) {
      out.push({ code: 'brandNew', severity: 'critical', source: 'self' });
    } else if (ageMs < 24 * 60 * 60 * 1000) {
      out.push({ code: 'newToken', severity: 'high', source: 'self' });
    }
  }
  if (d.mintActive || d.mintAuthority) {
    out.push({ code: 'mintActive', severity: 'high', source: d.mintActive ? 'goplus' : 'rugcheck' });
  }
  if (d.freezeActive || d.freezeAuthority) {
    out.push({ code: 'freezeActive', severity: 'high', source: d.freezeActive ? 'goplus' : 'rugcheck' });
  }
  if ((d.top10Pct ?? 0) > 80) {
    out.push({ code: 'concentration', severity: 'high', source: 'rugcheck' });
  }
  if (d.hasRugCheckData && (d.lpLockedPct ?? 100) < 20) {
    out.push({ code: 'lpUnlocked', severity: 'high', source: 'rugcheck' });
  }
  if (!d.hasRugCheckData && !d.hasGoPlusData) {
    out.push({ code: 'dataUnavailable', severity: 'high', source: 'self' });
  }

  return out;
}
