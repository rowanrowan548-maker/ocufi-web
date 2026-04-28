import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { claimInviteRebate } from '@/lib/invite-claim';
import * as apiClient from '@/lib/api-client';

/**
 * T-INV-114-onchain · invite-claim helper 测试
 *
 * Mock api-client.claimInviteRebate · 验 3 态映射:
 *   1. 后端代签 ship 后 claim_signature 有值 → tx_signature 透传
 *   2. 后端记账成但代签未跑(claim_signature null)→ pending_chain_settlement=true
 *   3. 后端返 ok:false → error 透传 sentinel
 *   4. api-client throw(网络错)→ error='network_error' 兜底
 */

beforeEach(() => {
  vi.spyOn(apiClient, 'claimInviteRebate').mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('claimInviteRebate · 后端代签 ship 后(未来路径)', () => {
  it('claim_signature 有值 → tx_signature 透传 · ok=true', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: true,
      claim_id: 42,
      amount_sol: 0.123,
      sol_lamports: 123_000_000,
      vault_address: 'AVmAj5Q...',
      claim_signature: '5xxxxx...sig',
      status: 'completed',
    });
    const r = await claimInviteRebate('UserWallet111111111111111111111111111111111');
    expect(r.ok).toBe(true);
    expect(r.tx_signature).toBe('5xxxxx...sig');
    expect(r.amount_sol).toBe(0.123);
    expect(r.pending_chain_settlement).toBeUndefined();
    expect(r.error).toBeUndefined();
  });
});

describe('claimInviteRebate · 当前路径(后端只记账,代签未 ship)', () => {
  it('ok:true 但 claim_signature 缺 → pending_chain_settlement=true', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: true,
      claim_id: 42,
      amount_sol: 0.123,
      sol_lamports: 123_000_000,
      vault_address: 'AVmAj5Q...',
      claim_signature: null, // 当前后端永远 null
      status: 'pending',
    });
    const r = await claimInviteRebate('UserWallet111111111111111111111111111111111');
    expect(r.ok).toBe(true);
    expect(r.tx_signature).toBeUndefined();
    expect(r.amount_sol).toBe(0.123);
    expect(r.pending_chain_settlement).toBe(true);
  });

  it('claim_signature 字段不存在(后端老版本)也走 pending', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: true,
      amount_sol: 0.05,
      // claim_signature 字段都不在 response 里
    });
    const r = await claimInviteRebate('UserWallet111111111111111111111111111111111');
    expect(r.ok).toBe(true);
    expect(r.pending_chain_settlement).toBe(true);
  });
});

describe('claimInviteRebate · 后端 ok:false → error 透传', () => {
  it('vault_not_configured', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: false,
      error: 'vault_not_configured',
    });
    const r = await claimInviteRebate('UserWallet1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('vault_not_configured');
  });

  it('rate_limited(24h cooldown)', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: false,
      error: 'rate_limited',
      vault_address: 'AVmAj5Q...',
    });
    const r = await claimInviteRebate('UserWallet1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('rate_limited');
  });

  it('no_rebate_yet · 用户没邀请人没积分', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: false,
      error: 'no_rebate_yet',
    });
    const r = await claimInviteRebate('UserWallet1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('no_rebate_yet');
  });

  it('below_min_claim · 携带 amount_sol 给前端显示阈值差距', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: false,
      error: 'below_min_claim',
      amount_sol: 0.0005, // 当前可领,< MIN_CLAIM_SOL=0.001
    });
    const r = await claimInviteRebate('UserWallet1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('below_min_claim');
    expect(r.amount_sol).toBe(0.0005);
  });

  it('exceeds_claimable · 用户 amount_sol > claimable', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: false,
      error: 'exceeds_claimable',
      amount_sol: 0.05, // claimable 上限
    });
    const r = await claimInviteRebate('UserWallet1', 0.1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('exceeds_claimable');
    expect(r.amount_sol).toBe(0.05);
  });

  it('error 字段缺失 → 兜底 unknown_error', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockResolvedValue({
      ok: false,
      // 后端理论不应该这样返,防御性兜底
    });
    const r = await claimInviteRebate('UserWallet1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('unknown_error');
  });
});

describe('claimInviteRebate · api-client throw → 网络兜底', () => {
  it('NEXT_PUBLIC_API_URL 未配置 / 网络错 → error="network_error"', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockRejectedValue(
      new Error('NEXT_PUBLIC_API_URL not configured')
    );
    const r = await claimInviteRebate('UserWallet1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network_error');
  });

  it('HTTP 5xx · api-client 抛 → 兜底', async () => {
    vi.spyOn(apiClient, 'claimInviteRebate').mockRejectedValue(
      new Error('API 502 /invite/claim: bad gateway')
    );
    const r = await claimInviteRebate('UserWallet1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network_error');
  });
});
