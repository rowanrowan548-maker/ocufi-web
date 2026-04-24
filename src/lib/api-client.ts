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
