/**
 * V2 Phase 3 · 透明度报告类型 + GET endpoint helper
 *
 * 跟后端 P3-BE-1 GET /transparency/<sig> schema 对齐(详 V2/SPECS/T-V2-PHASE-3.md §1 + §2.3)
 * sig 找不到 → 返 null · 上层 fallback "报告生成中"
 *
 * NUMERIC 列(NUMERIC(40,0)/NUMERIC(20,0))后端序列化为 string · 前端按需 BigInt / Number 解析
 * decimals 应用前用 raw_amount lib(reuse V1)· 但本文件不强求 · 给到 view 自己算
 */
import { apiFetch, ApiError } from './api-client';

/** 后端 GET /transparency/<sig> 返回 schema · 含 DB 列 + 计算字段 */
export type TransparencyReport = {
  // DB 主键
  sig: string;
  wallet: string; // 完整 wallet · UI 用 wallet_anonymized
  slot: number;

  // swap 方向
  side: 'buy' | 'sell';

  // token 双边
  token_in_mint: string;
  token_in_symbol: string;
  token_in_amount: string; // raw NUMERIC as string
  token_in_decimals: number;
  token_out_mint: string;
  token_out_symbol: string;
  token_out_amount: string;
  token_out_decimals: number;

  // 费率
  ocufi_fee_lamports: string;
  ocufi_fee_pct: number; // 0.001 = 0.1%
  comparable_fee_pct: number; // 0.01 = BullX 1%
  savings_lamports: string;
  savings_usd: number | null;

  // 链上 cost
  gas_lamports: string;
  compute_units: number | null;

  // 滑点
  slippage_tolerance_bps: number; // 100 = 1%
  slippage_actual_bps: number | null;

  // MEV
  mev_protected: boolean;
  mev_bundle_id: string | null;

  // Jupiter route(桑基图用)
  jupiter_route_dexes: string[] | null;
  jupiter_route_steps: unknown[] | null;

  // quote 元数据
  price_impact_pct: number | null;
  price_usd_at_swap: number | null;

  // 时间戳
  created_at: string; // ISO 8601

  // 后端计算字段(SPEC §2.3)
  wallet_anonymized: string; // '前4...后4'
  notional_sol: number; // float SOL · buy=token_in / sell=token_out
  savings_pct: number; // (comparable - ocufi) × 100
  route_dexes_str: string | null; // 'Raydium → Meteora'
};

/**
 * 后端 GET /transparency/<sig> 包 wrapper:`{ok, error, data}` · data = 真 report
 * P3-FE-2 bug 1:之前直接 cast 返回值致字段全 undefined · 现在解 wrapper 取 data
 */
type TransparencyWrapper = {
  ok: boolean;
  error: string | null;
  data: TransparencyReport | null;
};

/**
 * GET /transparency/<sig> · 找到返 report · 404 / 网络错 / 配置缺 / wrapper.ok=false → null
 * 不抛错 · 上层根据 null 渲染 fallback "报告生成中"
 */
export async function getTransparencyReport(sig: string): Promise<TransparencyReport | null> {
  if (!sig || sig.length < 8) return null;
  try {
    const wrapper = await apiFetch<TransparencyWrapper>(`/transparency/${encodeURIComponent(sig)}`);
    return wrapper.ok && wrapper.data ? wrapper.data : null;
  } catch (e) {
    if (e instanceof ApiError) {
      // 404 = 报告未生成 · 网络错 / 511 = 配置缺 / 5xx = 后端故障 · 都返 null 让 UI fallback
      return null;
    }
    return null;
  }
}

/**
 * raw amount (string) → decimal float · 给 UI 显示
 * 用 string 中转避 Number 大数精度损失
 */
export function rawToDecimal(raw: string, decimals: number): number {
  if (!raw) return 0;
  const n = BigInt(raw);
  if (decimals === 0) return Number(n);
  const divisor = 10 ** decimals;
  // 分整数部分 + 小数部分 · 防大数 lose precision
  // 99% case 数字够小 · Number 直接除够用
  return Number(n) / divisor;
}

/** lamports (string) → SOL float */
export function lamportsToSol(lamports: string): number {
  return rawToDecimal(lamports, 9);
}

/**
 * UI 数据映射(SPEC §4.2)· 把后端字段揉成 view-friendly shape
 * tx-view 用 · 防到处 inline 算
 */
export type TxViewData = {
  sig: string;
  sigShort: string;
  wallet: string;
  timestamp: string; // 'YYYY-MM-DD · HH:MM UTC'
  slot: number;

  // hero
  savedSol: number;
  savedUsd: number | null;
  side: 'buy' | 'sell';
  /** P3-FE-12 · 完整暴露 token in/out · HistoryRow 卖出要 in 维度 · buy 要 out 维度 */
  tokenIn: { mint: string; symbol: string; amount: number; decimals: number };
  tokenOut: { mint: string; symbol: string; amount: number; decimals: number };
  /** 兼容旧 tx-view 用法 · 始终指向 token_out(buy 是用户拿到的 / sell 是 SOL/USDC) */
  tokenAmount: number;
  tokenSymbol: string;
  tokenMint: string;
  notionalSol: number; // 花费 / 卖得 SOL
  vsCompetitorSol: number; // notional + (comparable - ocufi) × notional 反向算

  // P3-FE-4 polish 2 · SOL 显示精度 · 跟 savedSol 量级匹配 · 防 toFixed(4) 把 0.000045 截 0
  // dp 4:savedSol >= 0.0001 / dp 6:0 < savedSol < 0.0001 / dp 4 默(savedSol === 0)
  solDp: number;

  // cards
  slippagePct: number | null;
  slippageTolerancePct: number;
  gasSol: number;
  gasUsd: number | null;
  feeSol: number;
  feePct: number;
  competitorFeePct: number;
  routeStr: string;
  finalPriceUsd: number | null;
  priceImpactPct: number | null;
  mevProtected: boolean;
  mevBundleId: string | null;

  // engineer
  jupiterRouteSteps: unknown[] | null;
};

/**
 * P3-FE-4 polish 2a · 跟 savedSol 量级匹配的 dp · hero / subText 都共用 · 防 0.0050 跟 0.005045 显得一样
 */
export function pickSolDp(savedSol: number): number {
  if (savedSol === 0) return 4;
  if (savedSol >= 0.0001) return 4;
  return 6;
}

export function mapReportToView(r: TransparencyReport): TxViewData {
  const sigShort = r.sig.length >= 12 ? `${r.sig.slice(0, 6)}...${r.sig.slice(-4)}` : r.sig;
  const tokenInAmount = rawToDecimal(r.token_in_amount, r.token_in_decimals);
  const tokenOutAmount = rawToDecimal(r.token_out_amount, r.token_out_decimals);
  const savedSol = lamportsToSol(r.savings_lamports);
  const gasSol = lamportsToSol(r.gas_lamports);
  const feeSol = lamportsToSol(r.ocufi_fee_lamports);
  const vsCompetitorSol = r.notional_sol + savedSol;

  const date = new Date(r.created_at);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const timestamp = `${yyyy}-${mm}-${dd} · ${hh}:${min} UTC`;

  return {
    sig: r.sig,
    sigShort,
    wallet: r.wallet_anonymized,
    timestamp,
    slot: r.slot,
    savedSol,
    savedUsd: r.savings_usd,
    side: r.side,
    tokenIn: {
      mint: r.token_in_mint,
      symbol: r.token_in_symbol,
      amount: tokenInAmount,
      decimals: r.token_in_decimals,
    },
    tokenOut: {
      mint: r.token_out_mint,
      symbol: r.token_out_symbol,
      amount: tokenOutAmount,
      decimals: r.token_out_decimals,
    },
    tokenAmount: tokenOutAmount,
    tokenSymbol: r.token_out_symbol,
    tokenMint: r.token_out_mint,
    notionalSol: r.notional_sol,
    vsCompetitorSol,
    solDp: pickSolDp(savedSol),
    slippagePct: r.slippage_actual_bps == null ? null : r.slippage_actual_bps / 100,
    slippageTolerancePct: r.slippage_tolerance_bps / 100,
    gasSol,
    gasUsd: null, // gas USD 需 SOL_price · 后端报告未含 · 暂留 null · UI 显示 "—"
    feeSol,
    feePct: r.ocufi_fee_pct * 100,
    competitorFeePct: r.comparable_fee_pct * 100,
    routeStr: r.route_dexes_str ?? 'Jupiter',
    finalPriceUsd: r.price_usd_at_swap,
    priceImpactPct: r.price_impact_pct,
    mevProtected: r.mev_protected,
    mevBundleId: r.mev_bundle_id,
    jupiterRouteSteps: r.jupiter_route_steps,
  };
}
