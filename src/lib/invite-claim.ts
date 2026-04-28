/**
 * 邀请返佣提现 链上侧 helper(T-INV-114-onchain)
 *
 * 决策(2026-04-29 · 读 ocufi-api/app/api/invite.py:412-499):
 *   - 后端 `POST /invite/claim` 当前**只记账**(InviteClaim row · status='pending'),
 *     **不上链**;`claim_signature` 永远返 null。
 *   - SPEC 方案 B(前端组装 transfer ix)做不到 — 转账方向是 vault → user,
 *     vault 私钥只在后端,user wallet 没法签 vault 的转账。
 *   - 唯一路径:**🗄️ 后端工程师补一层代签上链**(读 vault keypair · 用 web3.py
 *     SystemProgram.transfer · 上链后回填 claim_signature)。链上工程师本 helper
 *     写"未来兼容版":后端 ship 代签后立即可用,无需改前端。
 *
 * 当前行为:
 *   - 调 api-client.claimInviteRebate(wallet, amountSol?)
 *   - 后端返 `claim_signature` → 成功 + tx_signature 出来(后端代签 ship 后)
 *   - 后端返 `ok:true` 但 claim_signature 缺 → pending_chain_settlement=true
 *     (当前永远走这,前端 UI 提示"已申请,链上结算中")
 *   - 后端返 `ok:false` → 透传 error sentinel(vault_not_configured / rate_limited /
 *     no_rebate_yet / below_min_claim / exceeds_claimable)
 *
 * 本 helper 不直接组 tx 也不签:
 *   - 链上工程师严格不接触私钥(包括 vault keypair)
 *   - 后端代签是唯一安全路径
 */

import { claimInviteRebate as _apiClaim } from './api-client';

export interface ClaimResult {
  ok: boolean;
  /** 后端代签上链成功后的 tx 签名(当前后端永远 undefined,等代签 ship) */
  tx_signature?: string;
  /** 实际记账金额 SOL(后端按 amount_sol 字段算) */
  amount_sol?: number;
  /**
   * `ok=true` 但 tx_signature 未到位 · 链上结算中(后端记账已成,代签尚未跑)。
   * 前端 UI 提示"已申请,链上结算中(预计几小时,可关闭页面)"
   */
  pending_chain_settlement?: boolean;
  /**
   * 错误 sentinel(透传后端):
   *   vault_not_configured · rate_limited · no_rebate_yet ·
   *   below_min_claim · exceeds_claimable · unknown_error
   */
  error?: string;
}

/**
 * 申请返佣提现 · helper 入口
 *
 * @param wallet     用户钱包地址(base58)
 * @param amountSol  可选 · 不传 = 全部可领(后端默认行为);传值 ≤ claimable
 * @returns          ClaimResult 三态(成功上链 / 等结算 / 错误)
 */
export async function claimInviteRebate(
  wallet: string,
  amountSol?: number
): Promise<ClaimResult> {
  try {
    const r = await _apiClaim(wallet, amountSol);

    // 后端返错 → 透传 sentinel
    if (!r.ok) {
      return {
        ok: false,
        error: r.error ?? 'unknown_error',
        // 部分错误后端会回填 amount_sol(below_min_claim / exceeds_claimable)给前端显示
        amount_sol: r.amount_sol ?? undefined,
      };
    }

    // 后端代签 ship 后 · claim_signature 有值 → 真实链上 tx_signature
    if (r.claim_signature) {
      return {
        ok: true,
        tx_signature: r.claim_signature,
        amount_sol: r.amount_sol ?? undefined,
      };
    }

    // 当前路径:后端记账成,链上结算未跑(后端代签未 ship)
    return {
      ok: true,
      amount_sol: r.amount_sol ?? undefined,
      pending_chain_settlement: true,
    };
  } catch (e) {
    // api-client 抛(NEXT_PUBLIC_API_URL 没配 / 网络错 / HTTP 5xx)
    console.warn('[invite-claim] api error:', e);
    return { ok: false, error: 'network_error' };
  }
}
