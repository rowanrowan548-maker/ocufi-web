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

export async function fetchPrice(mint: string): Promise<ApiTokenPrice> {
  return apiFetch<ApiTokenPrice>(`/price/${mint}`);
}

// ─── Day 10 points ───

export interface ClaimResult {
  ok: boolean;
  amount_awarded: number;
  new_balance: number;
  message: string;
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
}

export async function createAlert(
  wallet: string,
  mint: string,
  symbol: string,
  direction: 'above' | 'below',
  targetUsd: number
): Promise<ApiPriceAlert> {
  return apiFetch('/alerts', {
    method: 'POST',
    body: JSON.stringify({
      wallet, mint, symbol, direction, target_usd: targetUsd,
    }),
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
  status: 'pending' | 'activated';
  contributed_points: number;
  joined_at: string;
}

export interface InviteMeResp {
  code: string;
  invited_count: number;
  activated_count: number;
  earned_points: number;
  invitees: InviteeRow[];
}

export async function fetchInviteMe(address: string): Promise<InviteMeResp> {
  return apiFetch(`/invite/me?address=${address}`);
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
  return apiFetch<AdminStats>(`/admin/stats?key=${encodeURIComponent(key)}`);
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
