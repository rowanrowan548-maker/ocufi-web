/**
 * Helius Backrun rebate RPC helper(T-MEV-REBATE · 2026-04-30)
 *
 * 背景:
 *   gmgn / photon 把 MEV 利润全自己拿。Helius Developer plan($49/月)给 backrun rebate
 *   API · 单笔 sendTransaction 请求 URL 加 `rebate-address=用户钱包` query · MEV 50%
 *   返到用户钱包 · Helius 拿剩 50%。
 *
 * 限制(Helius 文档):
 *   - 仅 mainnet · devnet 不工作
 *   - 单笔 tx 请求(我们就是单笔 OK · batch sendTransaction 不会 backrun)
 *   - rebate 不修改 tx 内容 · 钱包签名后照发 · Phantom Lighthouse 不会 trigger
 *
 * 用法:
 *   1. env `NEXT_PUBLIC_HELIUS_RPC_URL` 配 Helius RPC base URL(已含 ?api-key=KEY)
 *   2. 发 swap tx 时调 `getRebateConnection(userPublicKey)` 拿专用 Connection
 *   3. 用这个 Connection 调 `sendRawTransaction` · 其余 RPC(simulate / balance / confirm)继续走默认 wallet-adapter Connection
 *   4. env 没配 / userPublicKey 空 → fallback null · 调用方转用默认 Connection
 */
import { Connection, PublicKey } from '@solana/web3.js';

/** 读 env · 没配返 '' · 容许空字符串(不抛错 · 不污染崩 prod) */
function getHeliusBaseUrl(): string {
  return process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? '';
}

/** Helius rebate 是否启用(env 配置 + 含 api-key query) */
export function isRebateEnabled(): boolean {
  const base = getHeliusBaseUrl();
  if (!base) return false;
  // sanity:Helius URL 必含 api-key query · 用户没配会有 mainnet-beta.solana.com 这种公共 RPC · 不该走 rebate
  return /helius/i.test(base) && /api-key=/i.test(base);
}

/**
 * 拼 rebate RPC URL · `${HELIUS_BASE}&rebate-address=${userPublicKey}`
 *
 * @param userPublicKey 用户钱包(PublicKey 或 base58 string)· MEV 返到这个地址
 * @returns URL · env 没配 / userPublicKey 无效返 '' · 调用方 fallback
 *
 * URL 拼接规则:
 *   - HELIUS_BASE 已含 `?api-key=...` · 所以追加用 `&rebate-address=...`
 *   - userPublicKey 用 base58 string · 走 `new PublicKey(...)` 校验防注入
 */
export function getRebateRpcUrl(userPublicKey: PublicKey | string): string {
  const base = getHeliusBaseUrl();
  if (!base) return '';

  let pkStr: string;
  try {
    pkStr =
      typeof userPublicKey === 'string'
        ? new PublicKey(userPublicKey).toBase58()
        : userPublicKey.toBase58();
  } catch {
    console.warn('[rpc-rebate] invalid userPublicKey · fallback no rebate');
    return '';
  }
  if (!pkStr) return '';

  // 防御:base 已带 query → `&` · 没带 query(理论不该发生 · Helius 必带 api-key)→ `?`
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}rebate-address=${pkStr}`;
}

/**
 * 构造 rebate-aware Connection · 仅用于 sendRawTransaction(swap tx)
 *
 * 不要给 simulate / balance / getLatestBlockhash 用 · 那些走默认 wallet-adapter
 * Connection 即可(Helius 配额按 RPS 计 · 切走 rebate 路径 = 浪费 swap-only credits)。
 *
 * @returns Connection · env 没配 / userPublicKey 无效返 null · 调用方 fallback 默认 Connection
 */
export function getRebateConnection(userPublicKey: PublicKey | string): Connection | null {
  const url = getRebateRpcUrl(userPublicKey);
  if (!url) return null;
  return new Connection(url, 'confirmed');
}
