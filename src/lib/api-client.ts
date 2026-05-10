/**
 * 统一封装 ocufi-api 后端请求
 *
 * 基础 URL 来自 NEXT_PUBLIC_API_URL(空则禁用后端相关功能)
 *
 * T-FE-STABILITY-ERROR-BOUNDARIES:
 *   - 加 15s AbortController timeout · 防 fetch 卡死
 *   - 抛 ApiError(extends Error · 含 status / path / body)· 上层 instanceof 区分 4xx/5xx/timeout
 *   - 不加 retry:对 POST(claim / alerts / invite)retry 可能重复扣费 / 双发 · 由调用方按需决定
 *   - backward compat:ApiError.message 跟旧 `API ${status} ${path}: ${text}` 字串兼容 · 现有 catch (e) 仍能 e.message 拿到信息
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const DEFAULT_TIMEOUT_MS = 15_000;

export function isApiConfigured(): boolean {
  return !!API_URL;
}

/** ApiFetch 失败时抛的 structured error · 上层可 instanceof ApiError 区分类型 */
export class ApiError extends Error {
  /** HTTP status · 0 = network/timeout · 511 = NEXT_PUBLIC_API_URL 未配 */
  readonly status: number;
  /** 请求路径(eg '/admin/stats')*/
  readonly path: string;
  /** body 头 200 字符 · 给 detail 显示用 */
  readonly body: string;
  /** true = AbortController 超时 / network 失败(无 status)· 上层可决定要不要 retry */
  readonly isNetwork: boolean;

  constructor(opts: { status: number; path: string; body: string; isNetwork: boolean }) {
    // 跟旧 throw `API ${status} ${path}: ${text}` 字串兼容 · 老 catch (e) e.message 仍读得到
    super(
      opts.isNetwork
        ? `API network ${opts.path}: ${opts.body}`
        : `API ${opts.status} ${opts.path}: ${opts.body}`,
    );
    this.name = 'ApiError';
    this.status = opts.status;
    this.path = opts.path;
    this.body = opts.body;
    this.isNetwork = opts.isNetwork;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  if (!API_URL) {
    throw new ApiError({
      status: 511,
      path,
      body: 'NEXT_PUBLIC_API_URL not configured',
      isNetwork: false,
    });
  }
  const url = `${API_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // AbortController timeout · 防止 fetch 卡死
  // init 也可能自带 signal · 优先用调用方的(允许外部取消)· 否则用我们的 timeout signal
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const signal = init?.signal ?? ctl.signal;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
  } catch (e: unknown) {
    clearTimeout(t);
    const isAbort = (e instanceof DOMException && e.name === 'AbortError') ||
      (e instanceof Error && e.name === 'AbortError');
    throw new ApiError({
      status: 0,
      path,
      body: isAbort ? `timeout ${timeoutMs}ms` : (e instanceof Error ? e.message : String(e)),
      isNetwork: true,
    });
  }
  clearTimeout(t);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError({
      status: res.status,
      path,
      body: text.slice(0, 200),
      isNetwork: false,
    });
  }
  return (await res.json()) as T;
}

// ─── Day 9 endpoints ───

export interface HealthResponse {
  status: string;
  env: string;
  time: string;
}

export async function pingHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

export interface ApiTokenPrice {
  mint: string;
  symbol: string;
  name: string;
  price_usd: number;
  price_native: number;
  liquidity_usd: number;
  market_cap: number;
  price_change_24h?: number | null;
  volume_24h?: number | null;
  logo_uri?: string | null;
}

// T-PERF-FE-DEDUP-REQUESTS · /price/<mint> 60s 缓存 + inflight dedup
// 同 mint 跨组件并发请求合并为 1 次后端调用(实测 SOL 重复 2 次 · 浪费 ~800ms)
const PRICE_CACHE_TTL_MS = 60_000;
const priceCache = new Map<string, { data: ApiTokenPrice; expiresAt: number }>();
const priceInflight = new Map<string, Promise<ApiTokenPrice>>();

export async function fetchPrice(mint: string): Promise<ApiTokenPrice> {
  const cached = priceCache.get(mint);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  let promise = priceInflight.get(mint);
  if (!promise) {
    promise = apiFetch<ApiTokenPrice>(`/price/${mint}`)
      .then((data) => {
        priceCache.set(mint, { data, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
        return data;
      })
      .finally(() => { priceInflight.delete(mint); });
    priceInflight.set(mint, promise);
  }
  return promise;
}

// ─── Day 10 points ───

export interface ClaimedBadge {
  code: string;
  nameZh: string;
  nameEn: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'legendary';
}

export interface ClaimResult {
  ok: boolean;
  amount_awarded: number;
  new_balance: number;
  message: string;
  /** T-906b · 后端在 claim 后评估新获得的徽章塞回 response */
  newBadges?: ClaimedBadge[];
}

export async function claimPoints(
  wallet: string,
  txSignature: string,
  usdValue?: number,
): Promise<ClaimResult> {
  return apiFetch<ClaimResult>('/points/claim', {
    method: 'POST',
    body: JSON.stringify({
      wallet,
      tx_signature: txSignature,
      ...(usdValue != null && Number.isFinite(usdValue) && usdValue > 0
        ? { usd_value: usdValue }
        : {}),
    }),
  });
}

export interface PointsMe {
  wallet: string;
  balance: number;
  event_count: number;
}

export async function fetchPointsMe(wallet: string): Promise<PointsMe> {
  return apiFetch<PointsMe>(`/points/me?wallet=${wallet}`);
}

export interface LeaderboardItem {
  rank: number;
  wallet_short: string;
  balance: number;
}

export interface Leaderboard {
  items: LeaderboardItem[];
  total_users: number;
}

export async function fetchLeaderboard(limit = 20): Promise<Leaderboard> {
  return apiFetch<Leaderboard>(`/points/leaderboard?limit=${limit}`);
}

// ─── Day 11 price alerts ───

export interface ApiPriceAlert {
  id: number;
  wallet: string;
  mint: string;
  symbol: string;
  direction: 'above' | 'below';
  target_usd: number;
  triggered: boolean;
  triggered_at: string | null;
  triggered_price_usd: number | null;
  acknowledged: boolean;
  created_at: string;
  // T-932a 字段(后端已 ship)· 老数据可能 null,前端兜底默认值
  is_active?: boolean;
  cooldown_minutes?: number;     // 30 / 60 / 120
  last_fired_at?: string | null;
  fire_count?: number;
  // T-953 触发条件模式
  mode?: 'absolute' | 'relative';
  baseline_price_usd?: number | null;
  change_pct?: number | null;
  // T-957b 触发后行为
  action?: 'notify' | 'execute';
  amount_sol?: number | null;
  slippage_bps?: number | null;
  executed_tx?: string | null;
}

export type CooldownMinutes = 30 | 60 | 120;
export type AlertAction = 'notify' | 'execute';

export interface CreateAlertOpts {
  cooldownMinutes?: CooldownMinutes;
  action?: AlertAction;
  amountSol?: number;
  slippageBps?: number;
}

export async function createAlert(
  wallet: string,
  mint: string,
  symbol: string,
  direction: 'above' | 'below',
  targetUsd: number,
  opts: CreateAlertOpts = {}
): Promise<ApiPriceAlert> {
  const cooldownMinutes = opts.cooldownMinutes ?? 60;
  const body: Record<string, unknown> = {
    wallet, mint, symbol, direction, target_usd: targetUsd,
    cooldown_minutes: cooldownMinutes,
  };
  if (opts.action) body.action = opts.action;
  if (opts.amountSol != null) body.amount_sol = opts.amountSol;
  if (opts.slippageBps != null) body.slippage_bps = opts.slippageBps;
  return apiFetch('/alerts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchAlert(
  wallet: string,
  id: number,
  patch: { is_active?: boolean; cooldown_minutes?: CooldownMinutes }
): Promise<ApiPriceAlert> {
  return apiFetch(`/alerts/${id}?wallet=${wallet}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function listAlerts(wallet: string): Promise<ApiPriceAlert[]> {
  return apiFetch(`/alerts?wallet=${wallet}`);
}

export async function deleteAlert(wallet: string, id: number): Promise<void> {
  await apiFetch(`/alerts/${id}?wallet=${wallet}`, { method: 'DELETE' });
}

export async function ackAlert(wallet: string, id: number): Promise<void> {
  await apiFetch(`/alerts/${id}/ack?wallet=${wallet}`, { method: 'POST' });
}

// ─── T-935 后端 /history(成交价 / 滑点 / 优先费 / Gas) ───
// 后端缓存 60s · 失败 200+ok:false · 前端只读不破坏现有 Helius 直连分类逻辑

export interface ApiHistoryRecord {
  tx_signature: string;
  status: 'success' | 'failed';
  timestamp: number | null;          // unix sec
  type?: string | null;              // 后端类型(可能不同于前端分类)
  source?: string | null;
  gas_lamports?: number | null;
  priority_fee_lamports?: number | null;
  input_mint?: string | null;
  input_amount?: number | null;
  output_mint?: string | null;
  output_amount?: number | null;
  actual_slippage_bps?: number | null; // V1 多为 null
}

export interface ApiHistoryResponse {
  ok: boolean;
  records?: ApiHistoryRecord[];
  error?: string;
}

export async function fetchHistoryEnriched(
  wallet: string,
  limit = 100
): Promise<ApiHistoryRecord[]> {
  const r = await apiFetch<ApiHistoryResponse>(`/history?wallet=${wallet}&limit=${limit}`);
  if (!r.ok) return [];
  return r.records ?? [];
}

// ─── T-931b TG binding(后端 T-931 ship 后启用) ───
// 若后端没暴露则 fetch 抛 404,前端 catch 退到 localStorage fallback
export interface TgBindingStatus {
  bound: boolean;
  tg_username?: string | null;
  bound_at?: string | null;
}

export async function fetchTgBinding(wallet: string): Promise<TgBindingStatus> {
  return apiFetch(`/alerts/tg-binding?wallet=${wallet}`);
}

// ─── Day 11 invite ───

export interface InviteRegisterResp {
  code: string;
}

export async function registerInviteCode(address: string): Promise<InviteRegisterResp> {
  return apiFetch('/invite/register', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
}

export interface InviteBindResp {
  bound: boolean;
  reason: 'ok' | 'already_bound' | 'invalid_code' | 'inviter_not_found' | 'self_invite';
}

export async function bindInvite(
  inviterCode: string,
  inviteeAddress: string,
): Promise<InviteBindResp> {
  return apiFetch('/invite/bind', {
    method: 'POST',
    body: JSON.stringify({ inviter_code: inviterCode, invitee_address: inviteeAddress }),
  });
}

export interface InviteeRow {
  address: string;
  /** T-945 #113 · 后端脱敏短地址 */
  address_short?: string;
  status: 'pending' | 'activated';
  contributed_points: number;
  joined_at: string;
  /** T-945 #116 · L1 直接邀请 / L2 二级邀请 */
  level?: number;
}

/** T-945 #112 · 返佣数字卡需要的字段 */
export interface RebateSummary {
  inviteCount: number;
  activatedCount: number;
  totalRebatePoints: number;
  totalRebateSol: number;
  totalRebateUsd: number;
  claimableSol: number;
  pendingClaimSol: number;
}

export interface InviteMeResp {
  code: string;
  invited_count: number;
  activated_count: number;
  earned_points: number;
  invitees: InviteeRow[];
  /** T-945 #112 · 返佣 · 旧后端无此字段 */
  rebate?: RebateSummary;
}

export async function fetchInviteMe(address: string): Promise<InviteMeResp> {
  return apiFetch(`/invite/me?address=${address}`);
}

// T-945 #114 · 申请返佣提现
export interface InviteClaimResp {
  ok: boolean;
  claim_id?: number | null;
  amount_sol?: number | null;
  // T-INV-114-be · 给链上侧组装/跟踪 transfer 用的字段(后端 invite.py 已返)
  sol_lamports?: number | null;
  vault_address?: string | null;
  amount_points?: number | null;
  status?: string | null;
  /** V2 链上结算完成后由后端 ship 代签时回填 · 当前后端只记账不上链 → 永远 null */
  claim_signature?: string | null;
  error?: string | null;
}

export async function claimInviteRebate(
  address: string,
  amountSol?: number,
): Promise<InviteClaimResp> {
  return apiFetch('/invite/claim', {
    method: 'POST',
    body: JSON.stringify({
      address,
      ...(amountSol != null ? { amount_sol: amountSol } : {}),
    }),
  });
}

// T-985c · /pool/stats-1h 1 小时聚合 + 买卖力量(后端已 ship)
export interface PoolStats1h {
  ok: boolean;
  buy_count: number;
  buy_volume_usd: number;
  sell_count: number;
  sell_volume_usd: number;
  net_volume_usd: number;
  total_volume_usd: number;
  fetched_at?: number | null;
  cached?: boolean;
  // T-FE-STALE-UI · 后端 T-PERF-STALE-FALLBACK 返旧数据时
  stale?: boolean;
  data_age_sec?: number | null;
  error?: string | null;
  retry_after?: number | null;
}

export async function fetchPoolStats1h(pool: string): Promise<PoolStats1h> {
  return apiFetch(`/pool/stats-1h?pool=${encodeURIComponent(pool)}`);
}

// T-OKX-1C-be · 6 项审计字段(Top 10 / 老鼠仓 / 开发者 / 捆绑 / 狙击 / LP burn)
export interface TokenAuditCard {
  ok: boolean;
  top10_pct?: number | null;            // 0-100
  rat_warehouse_pct?: number | null;    // 0-100
  dev_status?: 'cleared' | 'holding' | 'active' | null;
  bundle_pct?: number | null;           // 0-100
  sniper_pct?: number | null;           // 0-100
  lp_burn_pct?: number | null;          // 0-100
  cached?: boolean;
  // T-FE-STALE-UI · 后端 T-PERF-STALE-FALLBACK 返旧数据时
  stale?: boolean;
  data_age_sec?: number | null;
  error?: string | null;
}

// T-FE-PERF-V2-PREFETCH · audit-card 加 60s cache + inflight dedup(参 fetchPrice 同模式)
//   - hover 预取 + 组件 mount 真用 → 共享 1 次请求 · 不双发
//   - cache 60s · 重复访问同 mint 不调 backend
const AUDIT_CACHE_TTL_MS = 60_000;
const auditCardCache = new Map<string, { data: TokenAuditCard; expiresAt: number }>();
const auditCardInflight = new Map<string, Promise<TokenAuditCard>>();

export async function fetchTokenAuditCard(mint: string): Promise<TokenAuditCard> {
  const cached = auditCardCache.get(mint);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  let promise = auditCardInflight.get(mint);
  if (!promise) {
    promise = apiFetch<TokenAuditCard>(`/token/audit-card?mint=${encodeURIComponent(mint)}`)
      .then((data) => {
        auditCardCache.set(mint, { data, expiresAt: Date.now() + AUDIT_CACHE_TTL_MS });
        return data;
      })
      .finally(() => { auditCardInflight.delete(mint); });
    auditCardInflight.set(mint, promise);
  }
  return promise;
}

// T-OKX-4C-be · 按地址标签筛选 trades
export type TradeTag =
  | 'all' | 'kol' | 'rat' | 'whale' | 'sniper' | 'smart_money'
  | 'dev' | 'top10' | 'new_wallet' | 'bundler' | 'phishing';

export interface TradeByTagItem {
  tx_signature: string;
  block_time_ms: number;
  from_address: string;
  kind: 'buy' | 'sell';
  usd_value: number;
  tags?: TradeTag[];
}

export interface TradesByTagResp {
  ok: boolean;
  /** 后端 7fcd4a5 改名:items → trades · 老 FE 读 items 拿 undefined → 用户截图 9 tab 全空根因 */
  trades: TradeByTagItem[];
  /** 后端解析 mint → top pool 的结果 · null 表示找不到 */
  pool?: string | null;
  /** 'no_pool_found' 等业务态 · 给前端区分"没数据"和"系统错" */
  note?: string | null;
  cached?: boolean;
  fetched_at?: number | null;
  error?: string | null;
  retry_after?: number | null;
}

/**
 * 按地址标签筛选 trades · R-TAB-TRADES
 *
 * 后端 `7fcd4a5` 让 pool 变 optional · 加 mint 参数 · 后端用 _resolve_top_pool(mint) 自查 pool
 * 前端不再需要预先 fetchTokenInfo → topPoolAddress 来回一趟
 */
export async function fetchTradesByTag(
  mint: string,
  tag: TradeTag = 'all',
  limit = 100,
): Promise<TradesByTagResp> {
  const url = `/trades/by-tag?mint=${encodeURIComponent(mint)}&tag=${tag}&limit=${limit}`;
  return apiFetch(url);
}

// T-980-118 · /docs · /faq 全文搜索(后端 T-952 已 ship)
export interface SearchHit {
  id: string;
  title_zh: string;
  title_en: string;
  snippet: string;
  score: number;
}

export interface SearchResp {
  ok: boolean;
  items: SearchHit[];
  cached?: boolean;
}

export async function searchDocs(q: string, limit = 10): Promise<SearchResp> {
  const url = `/search/docs?q=${encodeURIComponent(q)}&limit=${limit}`;
  return apiFetch(url);
}

export async function searchFaq(q: string, limit = 10): Promise<SearchResp> {
  const url = `/search/faq?q=${encodeURIComponent(q)}&limit=${limit}`;
  return apiFetch(url);
}

// T-975 · v1(6 字符)→ v2(8 字符)邀请码升级
export interface InviteRegenerateResp {
  ok: boolean;
  code?: string | null;
  length?: number | null;
  upgraded: boolean;
  already_v2: boolean;
  error?: string | null;
}

export async function regenerateInviteCode(wallet: string): Promise<InviteRegenerateResp> {
  return apiFetch('/invite/regenerate', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
}

export interface InviteLeaderRow {
  rank: number;
  wallet_short: string;
  activated: number;
  points: number;
}

export interface InviteLeaderboardResp {
  items: InviteLeaderRow[];
}

export async function fetchInviteLeaderboard(limit = 10): Promise<InviteLeaderboardResp> {
  return apiFetch(`/invite/leaderboard?limit=${limit}`);
}

// T-INV-113 · 我的下线列表
export interface DownstreamRow {
  wallet: string;            // 完整地址(前端自截 4 位)
  first_trade_at?: string | null; // ISO date(首笔交易);可空表示尚未交易
  total_rebate_sol: number;
}

export interface InviteDownstreamResp {
  ok: boolean;
  total: number;
  page: number;
  page_size: number;
  items: DownstreamRow[];
}

export async function fetchInviteDownstream(
  wallet: string,
  page = 1,
  pageSize = 20,
): Promise<InviteDownstreamResp> {
  const url = `/invite/downstream?wallet=${encodeURIComponent(wallet)}&page=${page}&page_size=${pageSize}`;
  return apiFetch(url);
}

// ─── T-906 badges ───

export type BadgeRarity = 'common' | 'uncommon' | 'legendary';

export interface BadgeDef {
  code: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  icon: string;
  rarity: BadgeRarity;
  sortOrder: number;
}

export interface BadgesAllResp {
  ok: boolean;
  badges: BadgeDef[];
}

export async function fetchAllBadges(): Promise<BadgesAllResp> {
  return apiFetch<BadgesAllResp>('/badges/all');
}

export interface UserBadgeEarned {
  code: string;
  earnedAt: string;
  txSignature: string | null;
}

export interface BadgeProgress {
  swapCount: number;
  inviteCount: number;
  totalVolumeSol: number;
  registrationOrder: number;
}

export interface BadgesMeResp {
  ok: boolean;
  earned: UserBadgeEarned[];
  progress: BadgeProgress | Record<string, never>;
}

export async function fetchMyBadges(wallet: string): Promise<BadgesMeResp> {
  return apiFetch<BadgesMeResp>(`/badges/me?wallet=${wallet}`);
}

export interface BadgeLeaderRow {
  wallet: string;
  count: number;
  score: number;
}

export interface BadgesLeaderboardResp {
  ok: boolean;
  leaderboard: BadgeLeaderRow[];
}

export async function fetchBadgesLeaderboard(limit = 20): Promise<BadgesLeaderboardResp> {
  return apiFetch<BadgesLeaderboardResp>(`/badges/leaderboard?limit=${limit}`);
}

// ─── Admin stats(密码保护) ───

export interface AdminTopInviter {
  wallet_short: string;
  invited: number;
  activated: number;
  earned: number;
}
export interface AdminTopTrader {
  wallet_short: string;
  points: number;
  trade_count: number;
}
export interface AdminRecentEvent {
  wallet_short: string;
  event_type: string;
  amount: number;
  at: string;
}
export interface AdminTimeBucket {
  date: string;
  count: number;
}
export interface AdminTopPage {
  path: string;
  views: number;
}
export interface AdminTopReferrer {
  host: string;
  views: number;
}
export interface AdminDeviceCount {
  device: string;
  count: number;
}
export interface AdminStats {
  total_wallets: number;
  new_wallets_24h: number;
  new_wallets_7d: number;
  total_trades: number;
  trades_24h: number;
  trades_7d: number;
  total_points_awarded: number;
  points_24h: number;
  invite_bound: number;
  invite_activated: number;
  activation_rate_pct: number;
  repeat_wallet_count: number;
  repeat_rate_pct: number;
  daily_trades_30d: AdminTimeBucket[];
  daily_wallets_30d: AdminTimeBucket[];
  hourly_activity_24h: AdminTimeBucket[];
  total_page_views: number;
  page_views_24h: number;
  page_views_7d: number;
  unique_visitors_24h: number;
  unique_visitors_7d: number;
  daily_views_30d: AdminTimeBucket[];
  top_pages: AdminTopPage[];
  top_referrers: AdminTopReferrer[];
  device_breakdown: AdminDeviceCount[];
  top_inviters: AdminTopInviter[];
  top_traders: AdminTopTrader[];
  recent_events: AdminRecentEvent[];
}

export async function fetchAdminStats(key: string): Promise<AdminStats> {
  return apiFetch<AdminStats>('/admin/stats', {
    headers: { 'X-Admin-Key': key },
  });
}

// ─── T-FE-ADMIN-FEE-DASHBOARD · 费用收入聚合 ───

export type FeeRevenueWindow = '24h' | '7d' | '30d' | 'all';

export interface FeeTopSender {
  address: string;
  tx_count: number;
  total_sol: number;
}

export interface FeeDailyBucket {
  date: string;  // YYYY-MM-DD
  sol: number;
  tx_count: number;
}

export interface FeeRevenueResp {
  fee_address: string;
  window: FeeRevenueWindow;
  total_sol: number;
  total_usd: number;
  tx_count: number;
  top_senders: FeeTopSender[];
  daily: FeeDailyBucket[];
  computed_at: string;
}

export async function fetchAdminFeeRevenue(
  key: string,
  window: FeeRevenueWindow = '7d',
): Promise<FeeRevenueResp> {
  return apiFetch<FeeRevenueResp>(`/admin/fee-revenue?window=${window}`, {
    headers: { 'X-Admin-Key': key },
  });
}

// ─── T-FE-ADMIN-TRADE-VOLUME-CARD · 累计 GMV + Top 代币 ───

export interface TradeVolumeTopToken {
  mint: string;
  symbol: string;
  logo_url: string | null;
  trade_count: number;
  volume_usd: number;
}

export interface TradeVolumeResp {
  ok: boolean;
  window: FeeRevenueWindow;
  total_trades: number;
  total_volume_usd: number;
  avg_trade_usd: number;
  buy_count: number;
  sell_count: number;
  top_tokens: TradeVolumeTopToken[];
  computed_at: string;
}

export async function fetchAdminTradeVolume(
  key: string,
  window: FeeRevenueWindow = '7d',
): Promise<TradeVolumeResp> {
  return apiFetch<TradeVolumeResp>(`/admin/trade-volume?window=${window}`, {
    headers: { 'X-Admin-Key': key },
  });
}

// ─── T-FE-ADMIN-V1.5-DASHBOARD · BI 全套指标 ───

export interface BIVolumeBucket {
  /** hourly 时 = 'YYYY-MM-DDTHH:00:00Z' · daily 时 = 'YYYY-MM-DD' */
  bucket: string;
  trade_count: number;
  volume_usd: number;
}

export interface BIConversionFunnel {
  connect_count: number;
  /** 没事件就回 null · 不强报错(spec 降级原则)*/
  quote_request_count: number | null;
  swap_count: number;
  /** 0-100 · 子段为 null 时也回 null */
  connect_to_swap_rate: number | null;
  /** P5-BE-1 改 4 · 'analytics_event' 真埋点 / 'swap_floor' fallback 由 swap 数推 */
  connect_count_source?: 'analytics_event' | 'swap_floor';
  quote_request_count_source?: 'analytics_event' | 'swap_floor';
}

export interface BIMevRebate {
  total_mev_rebate_sol: number;
  total_mev_rebate_usd: number;
  unique_recipients: number;
  mev_24h_sol: number;
  mev_7d_sol: number;
}

export interface BIFailReason {
  /** suspected_sybil / daily_cap_hit / unknown · 详 fail_reasons_note */
  reason: string;
  count: number;
}

export interface BISuccessRate {
  swap_success_count: number;
  swap_fail_count: number;
  /** 0-100 · 总数为 0 时回 null */
  success_rate_pct: number | null;
  /** P5-BE-1 改 5 · awarded=false 拒因拆解 · 按 count desc · 无失败时 [] */
  fail_reasons?: BIFailReason[];
  /** P5-BE-1 改 5 · 语义边界:fail_count = 积分系统拒发 · 不是链上 swap 失败 */
  fail_reasons_note?: string;
}

export interface BITradeSizeDist {
  /** 全 null 表示 trade size 数据不足(<3 笔) */
  min_trade_usd: number | null;
  median_trade_usd: number | null;
  mean_trade_usd: number | null;
  p95_trade_usd: number | null;
  max_trade_usd: number | null;
}

export interface BIVolumeTimeSeries {
  hourly_volume_24h: BIVolumeBucket[];
  daily_volume_30d: BIVolumeBucket[];
}

export interface BIMetricsResp {
  ok: boolean;
  window: FeeRevenueWindow;
  /** spec 降级:section 字段拿不到 → 子字段 null · 不抛 500 */
  volume_time_series: BIVolumeTimeSeries;
  funnel: BIConversionFunnel;
  mev_rebate: BIMevRebate;
  tx_success: BISuccessRate;
  trade_size_distribution: BITradeSizeDist;
  fee_address?: string | null;
  sol_price_usd?: number;
  cached?: boolean;
  computed_at: string;
}

export async function fetchAdminBIMetrics(
  key: string,
  window: FeeRevenueWindow = '7d',
): Promise<BIMetricsResp> {
  return apiFetch<BIMetricsResp>(`/admin/bi-metrics?window=${window}`, {
    headers: { 'X-Admin-Key': key },
  });
}

// ─── P5-BE-1 改 1 · /admin/transparency-stats · V2 透明度报告统计 ───

export interface TransparencyTopToken {
  symbol: string | null;
  mint: string | null;
  count: number;
  total_saved_sol: number;
}

export interface TransparencyStatsResp {
  ok: boolean;
  computed_at: string;
  cached?: boolean;
  total: number;
  generated_24h: number;
  generated_7d: number;
  daily_30d: AdminTimeBucket[];
  top_tokens: TransparencyTopToken[];
  error?: string;
}

export async function fetchAdminTransparencyStats(
  key: string,
): Promise<TransparencyStatsResp> {
  return apiFetch<TransparencyStatsResp>('/admin/transparency-stats', {
    headers: { 'X-Admin-Key': key },
  });
}

// ─── P5-BE-1 改 2 · /admin/v2-vs-v1-pv · 7d V2 vs V1 PV 对比 ───

export interface V2V1TopPath {
  path: string;
  views: number;
}

export interface V2VsV1PvResp {
  ok: boolean;
  window: string;
  computed_at: string;
  cached?: boolean;
  v2_pv: number;
  v1_pv: number;
  v2_share_pct: number;
  v2_top_paths: V2V1TopPath[];
  v1_top_paths: V2V1TopPath[];
  error?: string;
}

export async function fetchAdminV2VsV1Pv(
  key: string,
): Promise<V2VsV1PvResp> {
  return apiFetch<V2VsV1PvResp>('/admin/v2-vs-v1-pv', {
    headers: { 'X-Admin-Key': key },
  });
}

// ─── P5-BE-1 改 3 · /admin/og-share-stats · X/TG unfurl 抓取数 ───

export interface OgShareTopPath {
  path: string;
  hits: number;
}

export interface OgShareStatsResp {
  ok: boolean;
  computed_at: string;
  cached?: boolean;
  total_og_hits: number;
  hits_24h: number;
  hits_7d: number;
  daily_30d: AdminTimeBucket[];
  top_paths: OgShareTopPath[];
  error?: string;
}

export async function fetchAdminOgShareStats(
  key: string,
): Promise<OgShareStatsResp> {
  return apiFetch<OgShareStatsResp>('/admin/og-share-stats', {
    headers: { 'X-Admin-Key': key },
  });
}

// ─── Public stats(无鉴权 · Landing 数据条用) ───

export interface PublicStats {
  total_wallets: number;
  total_trades: number;
  total_token_checks: number;
  unique_visitors_30d: number;
  // T-UI-OVERHAUL · 后端扩展(commit 1ddc4d2)· landing 第 4 屏 social 用
  total_users_saved_count?: number;
  total_saved_sol?: number;
  total_saved_usd?: number;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  return apiFetch<PublicStats>('/public/stats');
}

// T-UI-OVERHAUL · /portfolio/savings · 持仓页 SavingsCard + 老/新用户分流
export interface PortfolioSavingsTotals {
  saved_sol: number;
  saved_usd: number;
  fee_saved_sol: number;
  mev_saved_sol: number;
  ata_reclaimed_sol: number;
}

export interface PortfolioSavingsTradeRow {
  signature: string;
  block_time?: number | null;
  input_mint?: string | null;
  output_mint?: string | null;
  saved_sol?: number | null;
  saved_usd?: number | null;
  fee_saved_sol?: number | null;
  mev_saved_sol?: number | null;
  ata_reclaimed_sol?: number | null;
}

export interface PortfolioSavingsResponse {
  ok: boolean;
  wallet: string;
  trade_count: number;
  first_trade_at: string | null;
  totals: PortfolioSavingsTotals;
  per_trade: PortfolioSavingsTradeRow[];
  source?: 'transparency' | 'legacy_no_savings_data' | null;
  cached?: boolean;
  fetched_at?: number | null;
  error?: string | null;
}

export async function fetchPortfolioSavings(wallet: string): Promise<PortfolioSavingsResponse> {
  return apiFetch<PortfolioSavingsResponse>(
    `/portfolio/savings?wallet=${encodeURIComponent(wallet)}`,
  );
}

// T-UI-OVERHAUL · /portfolio/mev-savings · MEV 节省专项(后端 023b856 ship)
export interface PortfolioMevTradeRow {
  signature: string;
  saved_sol?: number | null;
  block_time?: number | null;
  used_sender?: boolean | null;
}

export interface PortfolioMevSavingsResponse {
  ok: boolean;
  wallet: string;
  total_saved_sol: number;
  total_trades: number;
  trades_using_sender: number;
  per_trade: PortfolioMevTradeRow[];
  cached?: boolean;
  fetched_at?: number | null;
  error?: string | null;
}

export async function fetchPortfolioMevSavings(wallet: string): Promise<PortfolioMevSavingsResponse> {
  return apiFetch<PortfolioMevSavingsResponse>(
    `/portfolio/mev-savings?wallet=${encodeURIComponent(wallet)}`,
  );
}

// ─── T-960 · /version backend (后端 commit + build time)───

export interface VersionInfo {
  name: string;
  commit: string;
  build_time: string;
  api_version: string;
}

export async function fetchBackendVersion(): Promise<VersionInfo> {
  return apiFetch<VersionInfo>('/version');
}

// ─── Day 11 user settings (email) ───

export interface UserSettingsApi {
  wallet_address: string;
  email: string | null;
  created_at: string | null;
}

export async function fetchUser(wallet: string): Promise<UserSettingsApi> {
  return apiFetch(`/user?wallet=${wallet}`);
}

export async function setUserEmail(wallet: string, email: string): Promise<{ ok: boolean; email?: string | null; error?: string }> {
  return apiFetch('/user/email', {
    method: 'POST',
    body: JSON.stringify({ wallet, email }),
  });
}

// ─── T-948 · /token/radar 雷达榜 ───

export type RadarCategory = 'risky' | 'safe';

export interface RadarItem {
  mint: string;
  symbol: string;
  name: string;
  category: string;
  riskReasons: string[];
  priceUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  priceChange24h: number | null;
  poolAgeHours: number | null;
  topPoolAddress: string | null;
  lastChecked: string;
}

export interface RadarResp {
  ok: boolean;
  /** T-948 · 后端字段名(主路径) */
  items?: RadarItem[];
  /** 后端 `RadarOut(list=items)` 历史拼写兼容(若部署版本有这个 typo) */
  list?: RadarItem[];
  cached: boolean;
}

export async function fetchTokenRadar(category: RadarCategory, limit = 20): Promise<RadarItem[]> {
  const r = await apiFetch<RadarResp>(`/token/radar?category=${category}&limit=${limit}`);
  return r.items ?? r.list ?? [];
}

// ─── T-955 · /markets/{trending,new-pairs} ───

export type MarketsTimeframe = '5m' | '15m' | '1h' | '24h';

export interface MarketItem {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  priceUsd: number | null;
  change5m: number | null;
  change1h: number | null;
  change24h: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  volumeH24: number | null;
  ageHours: number | null;
  buys24h: number | null;
  sells24h: number | null;
  holdersCount: number | null;
  topPoolAddress: string | null;
}

export interface MarketsResp {
  ok: boolean;
  items: MarketItem[];
  cached: boolean;
  stale?: boolean;
  // T-FE-STALE-UI · 与 PoolStats1h / TokenAuditCard 同语义
  data_age_sec?: number | null;
  fetched_at?: number | null;
  error?: string | null;
}

export async function fetchMarketsTrending(timeframe: MarketsTimeframe, limit = 50): Promise<MarketItem[]> {
  const r = await apiFetch<MarketsResp>(`/markets/trending?timeframe=${timeframe}&limit=${limit}`);
  return r.items ?? [];
}

export async function fetchMarketsNewPairs(limit = 50): Promise<MarketItem[]> {
  const r = await apiFetch<MarketsResp>(`/markets/new-pairs?limit=${limit}`);
  return r.items ?? [];
}

// ─── R6-FE · /portfolio/holdings ───
// P3-FE-5 · 后端 Pydantic 真返 camelCase · 字段名跟 backend 对齐 · TL curl 验过
//   logoURI / uiAmount / priceUsd / valueUsd / totalValueUsd

export interface HoldingItem {
  mint: string;
  symbol: string;
  name: string;
  /** UI display amount(decimals 应用后)· 后端字段 uiAmount */
  uiAmount: number;
  decimals: number;
  /** null = Helius fallback · 后端无价 */
  priceUsd: number | null;
  valueUsd: number | null;
  priceChange24hPct?: number | null;
  logoURI?: string | null;
}

export interface HoldingsResponse {
  ok: boolean;
  items: HoldingItem[];
  totalValueUsd?: number | null;
  /** 'birdeye' | 'helius' | 'none' */
  source?: string;
  cached?: boolean;
}

export async function fetchPortfolioHoldings(wallet: string): Promise<HoldingsResponse> {
  return apiFetch<HoldingsResponse>(`/portfolio/holdings?wallet=${encodeURIComponent(wallet)}`);
}

// ─── R3-FE · /search/tokens(后端 R3-BE `3a631f4` ship · Birdeye 主 + GT 兜底) ───

export interface SearchTokenItem {
  mint: string;
  symbol: string | null;
  name: string | null;
  logoURI?: string | null;
  price_usd?: number | null;
  liquidity_usd?: number | null;
  market_cap_usd?: number | null;
  volume_24h_usd?: number | null;
}

export interface SearchTokensResp {
  ok: boolean;
  items: SearchTokenItem[];
  source?: string;
  cached?: boolean;
  fetched_at?: number | null;
  error?: string | null;
}

export async function fetchSearchTokens(q: string, limit = 20): Promise<SearchTokenItem[]> {
  const trimmed = q.trim().slice(0, 80);
  if (trimmed.length < 1) return [];
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const url = `/search/tokens?q=${encodeURIComponent(trimmed)}&limit=${safeLimit}`;
  // 5s timeout · 后端有 GT 兜底 + 60s cache · 前端再加一层防御防 Railway 冷启卡死
  const r = await apiFetch<SearchTokensResp>(url, { timeoutMs: 5_000 });
  return r.items ?? [];
}

// ─── T-REWARDS-PAGE · /portfolio/empty-accounts ───

export interface EmptyAccount {
  mint: string;
  ata_address: string;
  rent_lamports: number;
  token_symbol: string | null;
  token_logo: string | null;
}

export interface EmptyAccountsResp {
  ok: boolean;
  wallet: string;
  count: number;
  accounts: EmptyAccount[];
  total_recoverable_lamports: number;
  total_recoverable_sol?: number;
}

export async function fetchEmptyAccounts(wallet: string): Promise<EmptyAccountsResp> {
  return apiFetch<EmptyAccountsResp>(`/portfolio/empty-accounts?wallet=${encodeURIComponent(wallet)}`);
}

// ─── T-HISTORY-CHAIN-DETAIL-FE · /portfolio/tx-detail ───
// 后端契约(数学守恒 · priority + base = total · 没数据时 ok:false 字段全 0):
//   GET /portfolio/tx-detail?signature=X
//   → { ok, type, priority_fee_sol, base_fee_sol, total_fee_sol, cached, error?, ... }

export interface TxDetail {
  ok: boolean;
  signature: string;
  type: string | null;
  priority_fee_sol: number;
  base_fee_sol: number;
  total_fee_sol: number;
  cached?: boolean;
  error?: string | null;
}

export async function fetchTxDetail(signature: string): Promise<TxDetail> {
  return apiFetch<TxDetail>(`/portfolio/tx-detail?signature=${encodeURIComponent(signature)}`);
}
