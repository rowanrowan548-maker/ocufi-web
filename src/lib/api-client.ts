/**
 * 统一封装 ocufi-api 后端请求
 *
 * 基础 URL 来自 NEXT_PUBLIC_API_URL(空则禁用后端相关功能)
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function isApiConfigured(): boolean {
  return !!API_URL;
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL not configured');
  const url = `${API_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text.slice(0, 200)}`);
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

export async function fetchTokenAuditCard(mint: string): Promise<TokenAuditCard> {
  return apiFetch(`/token/audit-card?mint=${encodeURIComponent(mint)}`);
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
  items: TradeByTagItem[];
  cached?: boolean;
  error?: string | null;
}

export async function fetchTradesByTag(
  pool: string,
  tag: TradeTag = 'all',
  limit = 100,
): Promise<TradesByTagResp> {
  const url = `/trades/by-tag?pool=${encodeURIComponent(pool)}&tag=${tag}&limit=${limit}`;
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

// ─── Public stats(无鉴权 · Landing 数据条用) ───

export interface PublicStats {
  total_wallets: number;
  total_trades: number;
  total_token_checks: number;
  unique_visitors_30d: number;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  return apiFetch<PublicStats>('/public/stats');
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
