/**
 * T-CHAIN-MEV-PROTECTION · Phase A · MEV 节省估算 + 上报后端
 *
 * SPEC: `.coordination/SPECS/T-CHAIN-MEV-PROTECTION.md` §2.2 + §2.3 + §3.2
 *
 * Phase A(本文件)· **零回归**:
 *   - 不动 swap-with-fee.ts / trade-tx.ts / chains.ts(主交易路径)
 *   - 在 execute-swap-plan confirm 后并行 fire-and-forget 调 analyzeTx + estimate + report
 *   - 上报失败静默 · 不阻断 swap UX
 *   - 后端 endpoint 没 ship 时(404 / network)console.warn · 不抛错
 *
 * Phase B(待用户拍板 · 见 SUB-SPEC `T-CHAIN-MEV-PROTECTION-PHASE-B.md`):
 *   - swap-with-fee.ts 切 Helius Sender 通道(强制 tip ix · 强制 skipPreflight · maxRetries=0)
 *   - 用户 tip 政策(0.0002 SOL `/fast` 还是 0.000005 SOL `?swqos_only=true`)
 *   - ix 顺序 + Phantom 1150 字节上限再评估
 *
 * Phase A 后:DB 有 `mev_protection_log` 行(如后端 ship)· 即便没切 Sender · 用户也能在
 * 持仓页 / 奖励页看到"按 0.5% 行业基准估算 · 你 N 笔 swap 实际滑点 X% · 省/亏 Y SOL"·
 * 等 Phase B Sender 切完 · 这个数字才有"我们的 MEV 保护省"语义。
 */
import type { JupiterQuote } from './jupiter';
import { apiFetch, ApiError, isApiConfigured } from './api-client';

/**
 * 行业基准:无 MEV 保护时,平均 sandwich + slippage 损失 = 50 bps(0.5%)
 *
 * 来源:Jito / Helius 公开报告(2025 Q4)· Solana 主流 swap aggregator 在不开 Sender 时
 * 真实滑点中位数 30-80 bps · meme 币偏高(100-300 bps)· 取保守均值 50 bps。
 *
 * Phase B Sender 切完后 · 真实滑点应 < 10 bps · `mev_saved_sol` 才有意义。
 */
const MEV_BASELINE_BPS = 50;
const BPS_DENOMINATOR = 10_000;

export interface MevSavingsEstimate {
  /** Jupiter quote 报价时的 expected out amount · raw token base unit */
  expectedOut: bigint;
  /** 链上真实成交收到的 out amount · raw token base unit · null 表示 analyzeTx 失败 */
  actualOut: bigint;
  /** 实际滑点 bps · (expected - actual) / expected · 负值 = 反向利好(罕见)*/
  realizedSlippageBps: number;
  /**
   * 保护节省估算 · SOL · 按 input SOL 量 × (基准 0.5% - 实际滑点) 算
   *
   * Phase A 阶段:
   *   - 用户走老路径 · 实际滑点 ~ 基准 0.5% · 节省 ≈ 0
   *   - 偶尔小币 sandwich 严重 → 实际 > 0.5% · 节省为负(报告里如实展示 · 不掩盖)
   * Phase B Sender 切完后 · 实际 < 0.1% · 节省 = (0.5% - 0.1%) × amount = 真有数据
   */
  mevSavedSol: number;
  /** input SOL 量 · 仅当 input 是 SOL 时填(买入)· 卖出 token → SOL 时 0 · 上层判断展示 */
  amountSol: number;
}

/**
 * MEV 节省估算
 *
 * 算法(对照 SPEC §2.2):
 *   realizedLossToken = expected - actual               (>0 = 用户收到比报价少)
 *   realizedSlippageBps = realizedLossToken / expected × 10000
 *   baselineLossSol = amountSol × 0.005                 (无保护行业基准 50 bps)
 *   realizedLossSol = amountSol × realizedSlippageBps / 10000
 *   mevSavedSol = baselineLossSol - realizedLossSol     (>0 = 我们帮用户省了)
 *
 * 边界:
 *   - quote / actual 任一为 0 → 滑点 0 + 节省 0(防 div/0)
 *   - actual > expected(反向利好 · 偶发 Jupiter 报价保守)→ 滑点 = 负 · 节省全计入(超出基准)
 *   - quote.outAmount 不可解析 BigInt → 抛 __ERR_MEV_QUOTE_INVALID
 */
export function estimateMevSavings(args: {
  quote: JupiterQuote;
  actualOutRaw: bigint;
  amountSol: number;
}): MevSavingsEstimate {
  const { quote, actualOutRaw, amountSol } = args;

  let expectedOut: bigint;
  try {
    expectedOut = BigInt(quote.outAmount);
  } catch {
    throw new Error('__ERR_MEV_QUOTE_INVALID');
  }

  if (expectedOut === BigInt(0)) {
    return {
      expectedOut: BigInt(0),
      actualOut: actualOutRaw,
      realizedSlippageBps: 0,
      mevSavedSol: 0,
      amountSol,
    };
  }

  // realizedLossBps · 用 BigInt 算保精度 · 最后 Number 转(bps 范围 -10000~+10000 安全)
  const lossRaw = expectedOut - actualOutRaw;
  // 走 BigInt 等比例放大避免浮点 · bps × 10000 留 4 位精度
  const lossBpsBig = (lossRaw * BigInt(BPS_DENOMINATOR)) / expectedOut;
  const realizedSlippageBps = Number(lossBpsBig);

  const baselineLossSol = amountSol * (MEV_BASELINE_BPS / BPS_DENOMINATOR);
  const realizedLossSol = amountSol * (realizedSlippageBps / BPS_DENOMINATOR);
  const mevSavedSol = baselineLossSol - realizedLossSol;

  return {
    expectedOut,
    actualOut: actualOutRaw,
    realizedSlippageBps,
    mevSavedSol,
    amountSol,
  };
}

/**
 * 上报 payload · 跟后端 SPEC §3.2 `POST /trades/report-mev` body 字段对齐
 *
 * 注意 BigInt 字段在 JSON 序列化前转 string(后端 NUMERIC(40,0) 列接 string OK)
 */
export interface MevReportPayload {
  sig: string;
  wallet: string;
  mint: string;
  amount_sol: number;
  expected_out: string; // BigInt → string · raw token base
  actual_out: string;
  mev_saved_sol_estimate: number;
  used_sender: boolean; // Phase A 永远 false · Phase B Sender 切完后 true
  realized_slippage_bps: number;
}

/**
 * 上报到后端 `POST /trades/report-mev` · fire-and-forget
 *
 * 失败静默策略(SPEC §2.3 隐含):
 *   - 后端没 ship 时 404 → console.warn 一次性提示 · 不抛
 *   - network / timeout / 5xx → console.warn · 不抛(swap 已成功 · 不能让 UX 卡)
 *   - NEXT_PUBLIC_API_URL 没配 → 静默 skip(本地开发场景)
 *
 * 返 boolean 表示成功与否 · 调用方可选择是否做本地 fallback
 */
export async function reportMevProtection(payload: MevReportPayload): Promise<boolean> {
  if (!isApiConfigured()) return false;

  try {
    await apiFetch('/trades/report-mev', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 5_000, // swap 后台上报 · 5s 够 · 别等太久
    });
    return true;
  } catch (e) {
    // ApiError 401/404/5xx + 网络错都吃掉 · 不阻断 UX
    if (e instanceof ApiError) {
      if (e.status === 404) {
        // 后端 endpoint 没 ship · 一次性 warn · 不刷屏
        console.warn(
          '[mev-protection] /trades/report-mev not deployed yet (Phase A · 后端待 ship)'
        );
      } else {
        console.warn(
          `[mev-protection] report failed (${e.status}): ${e.body.slice(0, 80)}`
        );
      }
    } else {
      console.warn('[mev-protection] report unexpected error:', e);
    }
    return false;
  }
}

/**
 * baseline bps 常量导出 · 给单测和 UI 显"对比 0.5% 行业基准"文案用
 */
export const MEV_PROTECTION_BASELINE_BPS = MEV_BASELINE_BPS;
