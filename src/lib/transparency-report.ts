/**
 * T-V2-PHASE-3 · P3-CHAIN-1 · 透明度报告 · swap confirm 后上报后端 endpoint
 *
 * SPEC: `.coordination/V2/SPECS/T-V2-PHASE-3.md`
 *   - §1 schema(对齐 transparency_reports DB 表 25 字段)
 *   - §3 链上 SPEC(本文件)
 *
 * 跟 V1 mev-protection 不冲突(TL 推荐并存):
 *   - V1 reportMevProtection · 比 quote vs analyzeTx · 抓 sandwich 滑点 · 写 mev_protection_log
 *   - V2 reportTransparency · 全字段透明度报告 · 写 transparency_reports · 给 /v2/tx/[sig] 用
 *   - 两个都 fire-and-forget · 同一笔 swap confirm 后并行调 · 各自上报独立 endpoint
 *
 * Phase 3 后续(V2 软发布后)可考虑砍 reportMevProtection · 让 transparency_reports 一份就够。
 */
import type { ParsedTransactionWithMeta, Connection, PublicKey } from '@solana/web3.js';
import type { JupiterQuote } from './jupiter';
import { SOL_MINT } from './jupiter';
import { getFeeBps } from './swap-with-fee';
import { estimateMevSavings } from './mev-protection';
import { analyzeTx, getDecimals } from './trade-tx';
import { apiFetch, ApiError, isApiConfigured } from './api-client';

/**
 * BullX 行业基准 fee 1% · 用于"省了 X SOL · vs BullX"散户大白话
 *
 * Photon / BananaGun / GMGN 也是 1% 量级 · 取 1% 作为可对标基准
 * env 旁路:NEXT_PUBLIC_TRANSPARENCY_COMPARABLE_FEE_PCT 可覆盖(default 0.01 = 1%)
 */
const COMPARABLE_FEE_PCT_DEFAULT = 0.01;

function getComparableFeePct(): number {
  const raw = process.env.NEXT_PUBLIC_TRANSPARENCY_COMPARABLE_FEE_PCT;
  if (!raw) return COMPARABLE_FEE_PCT_DEFAULT;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return COMPARABLE_FEE_PCT_DEFAULT;
  return n;
}

/**
 * 上报 payload · 字段对齐后端 SPEC §1 transparency_reports 表
 *
 * BigInt-ish 字段(NUMERIC(40,0))用 string 传 · 后端按 numeric 入库
 * nullable 字段缺失传 null · 不漏字段
 */
export interface TransparencyPayload {
  sig: string;
  wallet: string;
  slot: number;
  side: 'buy' | 'sell';

  token_in_mint: string;
  token_in_symbol: string;
  token_in_amount: string; // raw NUMERIC(40,0)
  token_in_decimals: number;
  token_out_mint: string;
  token_out_symbol: string;
  token_out_amount: string; // raw NUMERIC(40,0)
  token_out_decimals: number;

  /** Ocufi 收的 fee · lamports(buy 0.1% input SOL · sell 0) */
  ocufi_fee_lamports: string;
  /** 0.001 / 0 · 跟 getFeeBps 对应 */
  ocufi_fee_pct: number;
  /** 0.01(BullX 1%)对标基准 */
  comparable_fee_pct: number;
  /** (comparable - ocufi) × notional · lamports · BullX 同笔会多收的钱 */
  savings_lamports: string;
  /** USD 估值 · null = 没价格源 */
  savings_usd: number | null;

  /** 链上 base fee + priority fee · meta.fee */
  gas_lamports: string;
  /** meta.computeUnitsConsumed · null = RPC 没提供 */
  compute_units: number | null;

  /** 用户设的滑点 · quote.slippageBps */
  slippage_tolerance_bps: number;
  /** mev-protection.estimateMevSavings.realizedSlippageBps · null = analyzeTx 失败 */
  slippage_actual_bps: number | null;

  /** 是不是走 Helius Sender(signAndSendTxDetailed.usedSender) */
  mev_protected: boolean;
  /** Helius bundle id · 当前不抓 · 留 null · Phase 3.1 后续或可拿 */
  mev_bundle_id: string | null;

  /** Jupiter routePlan 提取 dex name 数组 · 给"Raydium → Meteora" 文案 */
  jupiter_route_dexes: string[] | null;
  /** Jupiter routePlan 完整 JSON · 给工程师视角 tab 折叠展示 */
  jupiter_route_steps: unknown | null;

  /** Jupiter quote.priceImpactPct 解析后 number · 解析失败 null */
  price_impact_pct: number | null;
  /** swap 时 token USD 价 · 当前不查 · 留 null */
  price_usd_at_swap: number | null;
}

/**
 * Response shape · 后端返 { ok, duplicate, error }(SPEC §2.3)
 */
export interface TransparencyReportResponse {
  ok: boolean;
  duplicate?: boolean;
  error?: string | null;
}

/**
 * 上报到 `POST /transparency/report` · fire-and-forget
 *
 * 失败静默策略(同 reportMevProtection):
 *   - 后端没 ship → 404 → console.warn "not deployed yet"(一次性 · 不刷屏)
 *   - 网络 / 5xx → console.warn(status + body) · 不抛
 *   - NEXT_PUBLIC_API_URL 没配 → 立刻返 false · 不打 fetch
 *
 * P3-CHAIN-2(2026-05-05 · 用户暴怒)· 防 0 amount 污染:
 *   - token_in_amount === 0 或 token_out_amount === 0 → 立刻返 false · 不上报
 *   - 场景:用户卖 100% 后回收 ATA 空 swap(无 token 转移)误触发 confirm 后上报路径
 *   - 后端 P3-BE-3 也加了双层防御(SPEC §61 用户拍板)· 链上侧先拦更省一次 RPC + 网络
 *
 * @returns true 成功上报(后端 200 · 含幂等 duplicate)/ false 静默失败 / false 0-amount skip
 */
export async function reportTransparency(payload: TransparencyPayload): Promise<boolean> {
  // P3-CHAIN-2 · 0 amount guard(链上侧防御 · 后端 P3-BE-3 是第二层)
  let inAmt: bigint;
  let outAmt: bigint;
  try {
    inAmt = BigInt(payload.token_in_amount || '0');
    outAmt = BigInt(payload.token_out_amount || '0');
  } catch {
    // 字段非数字字符串 · 当 0 处理 · skip
    console.warn('[transparency] skip · invalid amount(non-numeric)');
    return false;
  }
  if (inAmt === BigInt(0) || outAmt === BigInt(0)) {
    console.warn('[transparency] skip · 0 amount');
    return false;
  }

  if (!isApiConfigured()) return false;

  try {
    const res = await apiFetch<TransparencyReportResponse>('/transparency/report', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 5_000,
    });
    return res.ok === true;
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404) {
        console.warn(
          '[transparency-report] /transparency/report not deployed yet (Phase 3 后端 P3-BE-1 待 ship)'
        );
      } else {
        console.warn(
          `[transparency-report] report failed (${e.status}): ${e.body.slice(0, 80)}`
        );
      }
    } else {
      console.warn('[transparency-report] report unexpected error:', e);
    }
    return false;
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Jupiter routePlan 提取 dex label 数组 · 去重保序
 *
 * routePlan 形态:`Array<{ swapInfo: { label?: string, ... }, percent: number }>`
 * label 是 dex 名("Raydium" / "Meteora" / "Orca" / "Phoenix" 等)
 *
 * 解析失败 / 空 routePlan → 返 null(后端 nullable)
 */
export function extractRouteDexes(quote: JupiterQuote): string[] | null {
  if (!Array.isArray(quote.routePlan) || quote.routePlan.length === 0) return null;
  const labels: string[] = [];
  for (const step of quote.routePlan) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const swapInfo = (step?.swapInfo ?? {}) as any;
    const label = typeof swapInfo.label === 'string' ? swapInfo.label : null;
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.length > 0 ? labels : null;
}

/**
 * 解析 quote.priceImpactPct · 防 NaN
 */
export function parsePriceImpactPct(quote: JupiterQuote): number | null {
  if (typeof quote.priceImpactPct !== 'string') return null;
  const n = parseFloat(quote.priceImpactPct);
  return Number.isFinite(n) ? n : null;
}

/**
 * 给 mint 一个最简 symbol fallback(sync · 兜底用)
 *
 * - SOL_MINT → 'SOL'
 * - 其他 → mint.slice(0, 4)(占位 · 后端可重新查 jupiter token-list 补全)
 *
 * P3-CHAIN-3 起 · `recordTransparency` 优先用 async `resolveSymbol`(jupiter token-list 真名)·
 * 此 sync helper 仍保留:resolveSymbol 失败 / 不在 list 时兜底 · 单测复用
 */
export function fallbackSymbol(mint: string): string {
  if (mint === SOL_MINT) return 'SOL';
  return mint.slice(0, 4);
}

// ─── P3-CHAIN-3 · jupiter token-list 真 symbol 解析 ─────────────────────────

/**
 * Jupiter token list endpoint
 *
 * P3-CHAIN-4(2026-05-06)· strict → all 替换:
 *   - strict 不含 pump.fun 新币(用户暴怒 · token "DezX" 显丑根因之一)
 *   - all 数万 token · ~几 MB · 含 pump.fun · cache 1h(SPEC 拍板 · 新币 1h 内可感知)
 *   - 失败时 fallbackSymbol 仍兜底 mint.slice(0, 4)
 *   - 二级 birdeye fallback 留 follow-up(前端 lib 没 wrapper · 单独 task)
 *
 * 文档:https://station.jup.ag/docs/token-list/token-list-api
 */
const JUPITER_TOKEN_LIST_URL = 'https://token.jup.ag/all';

/** Token list 内存 cache TTL · 1h(P3-CHAIN-4 · pump 新币 1h 内可感知) */
const TOKEN_LIST_TTL_MS = 60 * 60 * 1000;
/** Fetch 失败短缓存 TTL · 5min(防 spam) */
const TOKEN_LIST_FAIL_TTL_MS = 5 * 60 * 1000;
/** Fetch timeout · 8s · all list 几 MB · 老挝网络保守 */
const TOKEN_LIST_FETCH_TIMEOUT_MS = 8_000;

interface TokenListEntry {
  symbol: string;
  logoURI?: string;
}

/**
 * Module-level state · client + server(Next 16)跨请求/swap 共享
 *
 * - mapPromise:in-flight 或 cached promise · race-safe(同时多个 swap 触发只 fetch 一次)
 * - cachedAt / cacheTTL:命中 / fail-soft 区分
 */
interface TokenListCache {
  mapPromise: Promise<Map<string, TokenListEntry>>;
  cachedAt: number;
  cacheTTL: number;
}
let tokenListCache: TokenListCache | null = null;

/**
 * 仅供单测 reset module state
 *
 * 生产代码不调 · 单测 beforeEach 调以保证隔离
 */
export function _resetTokenListCacheForTests(): void {
  tokenListCache = null;
}

/**
 * 拉 jupiter strict list + 解析 Map<mint, { symbol, logoURI }>
 *
 * 失败:返空 Map(下游查不到 → fallbackSymbol)+ 短 cache 5min 防 spam
 */
async function fetchTokenListMap(): Promise<Map<string, TokenListEntry>> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TOKEN_LIST_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(JUPITER_TOKEN_LIST_URL, {
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`[transparency] jupiter token-list fetch failed (${res.status})`);
      return new Map();
    }
    const list = (await res.json()) as Array<{
      address?: string;
      symbol?: string;
      logoURI?: string;
    }>;
    if (!Array.isArray(list)) {
      console.warn('[transparency] jupiter token-list malformed (not array)');
      return new Map();
    }
    const m = new Map<string, TokenListEntry>();
    for (const t of list) {
      if (typeof t.address === 'string' && typeof t.symbol === 'string' && t.symbol.length > 0) {
        m.set(t.address, { symbol: t.symbol, logoURI: t.logoURI });
      }
    }
    return m;
  } catch (e) {
    console.warn('[transparency] jupiter token-list fetch error:', e);
    return new Map();
  } finally {
    clearTimeout(t);
  }
}

/**
 * 获取 token list cache(lazy + 24h TTL · 失败短 cache 5min)
 *
 * Race-safe:同时多个 swap 触发 → 共用同一 in-flight promise · 不重复 fetch
 */
function getTokenListPromise(): Promise<Map<string, TokenListEntry>> {
  const now = Date.now();
  if (tokenListCache && now - tokenListCache.cachedAt < tokenListCache.cacheTTL) {
    return tokenListCache.mapPromise;
  }
  // 第一次或过期 · 重新拉
  const promise = fetchTokenListMap();
  // 乐观 cache 24h · 拉成功后保留;失败时 .then 内重写 cacheTTL = 5min
  tokenListCache = {
    mapPromise: promise,
    cachedAt: now,
    cacheTTL: TOKEN_LIST_TTL_MS,
  };
  // 失败短 cache 调降(避免 24h 都查不到)
  promise.then((m) => {
    if (m.size === 0 && tokenListCache && tokenListCache.mapPromise === promise) {
      tokenListCache.cacheTTL = TOKEN_LIST_FAIL_TTL_MS;
    }
  });
  return promise;
}

/**
 * 解析 mint 真 symbol(jupiter token-list)· 拿不到 fallback mint slice
 *
 * - SOL_MINT 短路返 'SOL'(不打 fetch)
 * - jupiter list 命中返真 symbol(BONK / USDC 等 · 主流 mint 99% 命中)
 * - 列表查无该 mint(冷门新 token)/ fetch 失败 → `fallbackSymbol(mint)` mint.slice(0, 4)
 *
 * P3-CHAIN-3 治根 #4 熵减:transparency_reports 表里直接存真 symbol · UI 显 "Bonk" 不再 "DezX"
 *
 * @param mint base58 token mint
 * @returns 真 symbol 或 4 字符兜底
 */
export async function resolveSymbol(mint: string): Promise<string> {
  if (mint === SOL_MINT) return 'SOL';
  try {
    const map = await getTokenListPromise();
    const entry = map.get(mint);
    if (entry && entry.symbol) return entry.symbol;
  } catch (e) {
    console.warn('[transparency] resolveSymbol error:', e);
  }
  return fallbackSymbol(mint);
}

/**
 * 算 ocufi fee lamports
 *
 * 跟 swap-with-fee.ts:367 `feeLamports` 同公式:floor(notional × bps / 10000)
 * env vault 没配时 swap 实际不收 fee · 但 transparency 报告仍按 bps 计算"应收"金额(给 UI 展示)
 *
 * @param notionalRaw  buy: SOL input lamports / sell: token input raw(实际 sell V1 fee=0 直接返 0)
 */
export function calcOcufiFeeLamports(notionalRaw: bigint, side: 'buy' | 'sell'): bigint {
  const bps = BigInt(getFeeBps(side));
  if (bps === BigInt(0)) return BigInt(0);
  return (notionalRaw * bps) / BigInt(10_000);
}

/**
 * 算"省了多少 lamports vs BullX"
 *
 * notional 定义:
 *   buy:input SOL lamports(用户花 X SOL · BullX 多收 0.9% × X · Ocufi 收 0.1% × X)
 *   sell:output SOL lamports(用户拿 X SOL · BullX 多收 1% × X · Ocufi 0%)
 *
 * @param notionalSolLamports  notional 折成 SOL 的 lamports(buy 是 inAmount · sell 是 outAmount)
 * @param ocufiFeePct  Ocufi 实际收的 % · buy 0.001 sell 0
 * @param comparableFeePct  对标 BullX % · 默认 0.01
 */
export function calcSavingsLamports(
  notionalSolLamports: bigint,
  ocufiFeePct: number,
  comparableFeePct: number
): bigint {
  const diffBps = Math.round((comparableFeePct - ocufiFeePct) * 10_000);
  if (diffBps <= 0) return BigInt(0);
  return (notionalSolLamports * BigInt(diffBps)) / BigInt(10_000);
}

/**
 * 拿链上 swap receipt 字段(slot / gas / CU)
 *
 * 复用 analyzeTx 同款 RPC 查 · 重试已封装 · 失败返 null(payload 字段标 nullable 处理)
 *
 * 注意:这跟 analyzeTx 是两次独立 RPC 查 · Phase 3 暂不优化(单笔上报 1 次额外 RPC 可接受)
 *   · 优化方向:execute-swap-plan 调 analyzeTx 后传 raw ParsedTransactionWithMeta 给本 helper · 减一次查询
 */
export async function fetchSwapReceipt(
  connection: Connection,
  sig: string
): Promise<{ slot: number; gasLamports: bigint; computeUnits: number | null } | null> {
  let parsed: ParsedTransactionWithMeta | null = null;
  try {
    parsed = await connection.getParsedTransaction(sig, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
  } catch (e) {
    console.warn('[transparency-report] getParsedTransaction failed:', e);
    return null;
  }
  if (!parsed || !parsed.meta) return null;
  return {
    slot: parsed.slot,
    gasLamports: BigInt(parsed.meta.fee ?? 0),
    // computeUnitsConsumed 可能 undefined(老 RPC)· 标 nullable
    computeUnits:
      typeof parsed.meta.computeUnitsConsumed === 'number'
        ? parsed.meta.computeUnitsConsumed
        : null,
  };
}

// ─── 主入口:execute-swap-plan 在 swap confirm 后调 ──────────────────────────

/**
 * recordTransparency · execute-swap-plan confirm 后并行 fire-and-forget
 *
 * 数据组装 + 上报 一站式 · 全部失败静默 · console.warn 不抛
 */
export async function recordTransparency(args: {
  connection: Connection;
  userPk: PublicKey;
  sig: string;
  quote: JupiterQuote;
  /** Helius Sender 真用了的标志(从 signAndSendTxDetailed.usedSender 拿) */
  usedSender: boolean;
}): Promise<void> {
  const { connection, userPk, sig, quote, usedSender } = args;
  try {
    const isBuy = quote.inputMint === SOL_MINT;
    const side: 'buy' | 'sell' = isBuy ? 'buy' : 'sell';

    // 输出 token decimals + analyzeTx 拿真实 actual out
    const outputMint = quote.outputMint;
    const outDecimals = await getDecimals(connection, outputMint).catch(() => 9);
    const inputMint = quote.inputMint;
    const inDecimals = await getDecimals(connection, inputMint).catch(() => 9);

    const analysis = await analyzeTx(connection, sig, userPk, outputMint);
    if (!analysis) {
      console.info('[transparency-report] analyzeTx null · skip(RPC indexer 滞后)');
      return;
    }
    const actualOutRaw = BigInt(
      Math.max(0, Math.round(analysis.tokenDelta * 10 ** outDecimals))
    );

    const inAmountRaw = BigInt(quote.inAmount);
    const notionalSolLamports = isBuy ? inAmountRaw : actualOutRaw;
    // amountSol 给 estimateMevSavings 算 mev_saved_sol(只 buy 有意义 · sell 用 actual SOL out)
    const amountSol = Number(notionalSolLamports) / 1e9;
    const estimate = estimateMevSavings({ quote, actualOutRaw, amountSol });

    const ocufiBps = getFeeBps(side);
    const ocufiFeeLamports = calcOcufiFeeLamports(notionalSolLamports, side);
    const ocufiFeePct = ocufiBps / 10_000;
    const comparableFeePct = getComparableFeePct();
    const savingsLamports = calcSavingsLamports(
      notionalSolLamports,
      ocufiFeePct,
      comparableFeePct
    );

    const receipt = await fetchSwapReceipt(connection, sig);

    // P3-CHAIN-3 · 拿真 symbol(jupiter token-list · 24h cache)· 拿不到兜底 mint slice
    //   并行解析 in + out · race-safe(共用同一 in-flight token list promise)
    const [tokenInSymbol, tokenOutSymbol] = await Promise.all([
      resolveSymbol(inputMint),
      resolveSymbol(outputMint),
    ]);

    const payload: TransparencyPayload = {
      sig,
      wallet: userPk.toBase58(),
      slot: receipt?.slot ?? 0,
      side,

      token_in_mint: inputMint,
      token_in_symbol: tokenInSymbol,
      token_in_amount: inAmountRaw.toString(),
      token_in_decimals: inDecimals,
      token_out_mint: outputMint,
      token_out_symbol: tokenOutSymbol,
      token_out_amount: actualOutRaw.toString(),
      token_out_decimals: outDecimals,

      ocufi_fee_lamports: ocufiFeeLamports.toString(),
      ocufi_fee_pct: ocufiFeePct,
      comparable_fee_pct: comparableFeePct,
      savings_lamports: savingsLamports.toString(),
      savings_usd: null, // Phase 3 暂不查 USD 价 · 后端有 price source 可补

      gas_lamports: (receipt?.gasLamports ?? BigInt(0)).toString(),
      compute_units: receipt?.computeUnits ?? null,

      slippage_tolerance_bps: quote.slippageBps,
      slippage_actual_bps: estimate.realizedSlippageBps,

      mev_protected: usedSender,
      mev_bundle_id: null, // Phase 3.x · Helius Sender response 含 bundle_id 时再补

      jupiter_route_dexes: extractRouteDexes(quote),
      // 完整 routePlan 给工程师视角 · 后端 JSONB 存原样
      jupiter_route_steps: quote.routePlan ?? null,

      price_impact_pct: parsePriceImpactPct(quote),
      price_usd_at_swap: null,
    };

    void reportTransparency(payload);
  } catch (e) {
    console.warn('[transparency-report] recordTransparency failed (non-blocking):', e);
  }
}

/** 给单测 / UI 文案对齐用的常量导出 */
export const TRANSPARENCY_COMPARABLE_FEE_PCT_DEFAULT = COMPARABLE_FEE_PCT_DEFAULT;
