/**
 * Solana RPC 健康探测
 *
 * 用 connection.getLatestBlockhash('confirmed') 当 ping
 * 延迟阈值:< 1s healthy / 1-3s degraded / >3s 或 fail down
 *
 * 配套 hook: src/hooks/use-rpc-health.ts
 * 完整 SPEC: .coordination/SPECS/T-201-rpc-health-banner.md
 */
import type { Connection } from '@solana/web3.js';

export type RpcHealth = 'healthy' | 'degraded' | 'down' | 'checking';

export interface RpcHealthResult {
  health: RpcHealth;
  /** 探测延迟(ms),未拿到时 undefined */
  latencyMs?: number;
  /** 最近一次探测时间(ms epoch) */
  checkedAt: number;
  /** 当前 endpoint 脱敏字符串(隐藏 api-key);用于 UI 显示 */
  endpointLabel: string;
  /** 错误简述(403 / 429 / timeout 等);成功时 undefined */
  error?: string;
  /** 是否在使用公共节点 fallback(true 时 UI 应总是 warning 级提示) */
  isPublicFallback: boolean;
}

const LATENCY_HEALTHY_MAX_MS = 1000;
const LATENCY_DEGRADED_MAX_MS = 3000;
const PROBE_TIMEOUT_MS = 5000;

const PUBLIC_RPC_HOSTNAMES = new Set([
  'api.mainnet-beta.solana.com',
  'api.devnet.solana.com',
  'api.testnet.solana.com',
]);

/**
 * 把 RPC URL 脱敏(隐藏 Helius api-key 等)
 * 'https://mainnet.helius-rpc.com/?api-key=abc123' → 'mainnet.helius-rpc.com'
 *
 * 仅返回 hostname,不返回 path / query,确保 api-key 永不暴露
 */
export function sanitizeEndpoint(rpcUrl: string): string {
  try {
    return new URL(rpcUrl).hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** 当前 endpoint 是否是公共节点 fallback */
export function isPublicSolanaRpc(rpcUrl: string): boolean {
  try {
    return PUBLIC_RPC_HOSTNAMES.has(new URL(rpcUrl).hostname);
  } catch {
    return false;
  }
}

function classifyError(msg: string): string {
  if (/403/i.test(msg)) return '403 Forbidden(可能 api-key 失效)';
  if (/429/i.test(msg) || /rate.?limit/i.test(msg)) return '429 Rate Limited(超出免费配额)';
  if (/timeout|abort/i.test(msg)) return 'Timeout';
  return msg.length > 80 ? msg.slice(0, 80) + '…' : msg;
}

function classifyHealth(latencyMs: number): RpcHealth {
  if (latencyMs < LATENCY_HEALTHY_MAX_MS) return 'healthy';
  if (latencyMs < LATENCY_DEGRADED_MAX_MS) return 'degraded';
  return 'down';
}

/**
 * 探测 RPC 健康(永不抛,失败也返回 result.health='down')
 *
 * @param connection wallet-adapter 提供的 Connection 实例
 */
export async function probeRpc(connection: Connection): Promise<RpcHealthResult> {
  const endpoint = connection.rpcEndpoint;
  const endpointLabel = sanitizeEndpoint(endpoint);
  const isPublicFallback = isPublicSolanaRpc(endpoint);
  const start = Date.now();

  try {
    // getLatestBlockhash 是 RPC 最便宜的 "ping" 之一,所有 Solana 节点都支持
    // 用 Promise.race 实现超时,因为 web3.js Connection 没暴露 fetch signal
    const result = await Promise.race([
      connection.getLatestBlockhash('confirmed'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), PROBE_TIMEOUT_MS)
      ),
    ]);
    void result; // 拿不到 blockhash 不重要,只测可达性
    const latencyMs = Date.now() - start;
    return {
      health: classifyHealth(latencyMs),
      latencyMs,
      checkedAt: Date.now(),
      endpointLabel,
      isPublicFallback,
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      health: 'down',
      latencyMs,
      checkedAt: Date.now(),
      endpointLabel,
      isPublicFallback,
      error: classifyError(msg),
    };
  }
}
