/**
 * R10-FE · /copy-trading 后端 9 endpoint 封装
 *
 * 后端契约源:`.coordination/REPORTS/backend.md` L4790 · commit `704c3b0`
 * 注意:实际 path / schema 跟 SPEC 草稿不一样 · 以下面为准
 *  - `/copy-trading/follow` (POST/PATCH/DELETE)
 *  - `/copy-trading/subscriptions[?wallet=]` (GET 列表 + GET /{id})
 *  - `/copy-trading/jobs` (GET 列表 + 单 job 操作)
 *  - `/copy-trading/stats?wallet=`
 *  - V1 鉴权简化:wallet 永远当 query 参数(同 alerts.py)
 */
import { apiFetch } from '@/lib/api-client';

// ─────────────────────────────────────────────────
// 类型定义(snake_case 同后端 pydantic schema)
// ─────────────────────────────────────────────────

export type RatioMode = 'fixed' | 'mirror';

export type JobStatus =
  | 'pending'    // 后端落单 · 等用户签
  | 'skipped'    // 评估时被过滤(黑名单 / 超额 / 暂停)· 不需用户操作
  | 'queued'     // 用户已确认 · 准备签
  | 'signed'     // 用户已签 · 等链上 confirm
  | 'submitted'  // 已提交链上(ack-signed 已收 sig)
  | 'confirmed'  // 链上 confirmed
  | 'failed';    // 任意阶段失败

export type SkipReason =
  | 'blacklisted_mint'
  | 'over_per_trade_limit'
  | 'over_total_limit'
  | 'emergency_stop'
  | 'disabled'
  | 'user_canceled';

export interface SubscriptionOut {
  id: string;
  user_wallet: string;
  target_wallet: string;
  /** 单笔 SOL 上限 · 后端硬 cap 50 SOL 防误填 */
  max_sol_per_trade: number;
  /** 总额 SOL 上限 · null = 不限 */
  max_sol_total: number | null;
  /** 累计已用 SOL · 由 worker 加 */
  spent_sol_total: number;
  ratio_mode: RatioMode;
  /** 滑点千分点 · 默认 500 = 5% */
  slippage_bps: number;
  /** 止盈百分比 · null = 不设 */
  take_profit_pct: number | null;
  stop_loss_pct: number | null;
  /** mint 黑名单(KOL 买这些不跟) */
  blacklist_mints: string[];
  /** ISO datetime · null = 永远手动签 */
  auto_sign_until: string | null;
  /** 用户暂停 */
  enabled: boolean;
  /** 独立紧急停 */
  emergency_stop: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobOut {
  id: string;
  subscription_id: string;
  user_wallet: string;
  target_wallet: string;
  /** KOL 那笔的链上 sig */
  target_swap_signature: string;
  status: JobStatus;
  skip_reason: SkipReason | null;
  /** KOL swap 元数据快照(input/output mint · amount · 等) */
  event_metadata: Record<string, unknown>;
  /** 后端评估出的应跟金额(SOL) */
  proposed_sol_amount?: number | null;
  /** 用户签后回填 */
  user_swap_signature: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatsOut {
  total_subscriptions: number;
  active_count: number;
  spent_sol_total: number;
  /** 各 status 的 job 数 */
  job_counts_by_status: Partial<Record<JobStatus, number>>;
}

// ─────────────────────────────────────────────────
// 9 endpoint
// ─────────────────────────────────────────────────

/** 1. 创建 / 更新订阅(同 user+target 已存在则后端当 update) */
export interface FollowCreateInput {
  user_wallet: string;
  target_wallet: string;
  max_sol_per_trade: number;
  max_sol_total?: number | null;
  ratio_mode?: RatioMode;
  slippage_bps?: number;
  take_profit_pct?: number | null;
  stop_loss_pct?: number | null;
  blacklist_mints?: string[];
  auto_sign_until?: string | null;
}

export async function createFollow(body: FollowCreateInput): Promise<SubscriptionOut> {
  return apiFetch<SubscriptionOut>('/copy-trading/follow', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 2. 列订阅 */
export async function listSubscriptions(wallet: string, includeDisabled = true): Promise<SubscriptionOut[]> {
  const url = `/copy-trading/subscriptions?wallet=${encodeURIComponent(wallet)}&include_disabled=${includeDisabled}`;
  return apiFetch<SubscriptionOut[]>(url);
}

/** 3. 单条订阅详情 */
export async function getSubscription(id: string): Promise<SubscriptionOut> {
  return apiFetch<SubscriptionOut>(`/copy-trading/subscriptions/${encodeURIComponent(id)}`);
}

/** 4. 修改订阅(暂停 / 紧急停 / 续 auto_sign / 改参数) */
export interface FollowPatchInput {
  max_sol_per_trade?: number;
  max_sol_total?: number | null;
  ratio_mode?: RatioMode;
  slippage_bps?: number;
  take_profit_pct?: number | null;
  stop_loss_pct?: number | null;
  blacklist_mints?: string[];
  auto_sign_until?: string | null;
  enabled?: boolean;
  emergency_stop?: boolean;
}

export async function patchFollow(id: string, patch: FollowPatchInput): Promise<SubscriptionOut> {
  return apiFetch<SubscriptionOut>(`/copy-trading/follow/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** 5. 取消订阅(soft delete · 后端保留历史) */
export async function deleteFollow(id: string): Promise<void> {
  await apiFetch(`/copy-trading/follow/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** 6. 用户跟单历史(支持按状态 / leader 过滤 + 翻页) */
export interface ListJobsParams {
  wallet: string;
  status?: JobStatus;
  target?: string;
  limit?: number;
  offset?: number;
}

export async function listJobs(params: ListJobsParams): Promise<JobOut[]> {
  const q = new URLSearchParams({ wallet: params.wallet });
  if (params.status) q.set('status', params.status);
  if (params.target) q.set('target', params.target);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  return apiFetch<JobOut[]>(`/copy-trading/jobs?${q.toString()}`);
}

/** 7. 跟单概览(总订阅 / active / spent SOL / 各状态 job 数) */
export async function fetchStats(wallet: string): Promise<StatsOut> {
  return apiFetch<StatsOut>(`/copy-trading/stats?wallet=${encodeURIComponent(wallet)}`);
}

/** 8. 用户签名上链后回填 sig + 标记 submitted */
export async function ackJobSigned(jobId: string, userSwapSignature: string): Promise<JobOut> {
  const url = `/copy-trading/jobs/${encodeURIComponent(jobId)}/ack-signed?user_swap_signature=${encodeURIComponent(userSwapSignature)}`;
  return apiFetch<JobOut>(url, { method: 'POST' });
}

/** 9. 用户主动取消未签名 job */
export async function cancelJob(jobId: string): Promise<JobOut> {
  return apiFetch<JobOut>(`/copy-trading/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
}
