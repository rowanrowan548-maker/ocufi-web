/**
 * GoPlus Security · Solana Token Security
 *
 * 免费公开,无需 API Key。文档:
 *  https://docs.gopluslabs.io/reference/solanatokensecurityusingget
 *
 * 我们用它做 RugCheck 的二次验证 + 蜜罐特征(transfer_fee / non_transferable / freezable)。
 * 任一源标 critical → token-info.overallRisk 升级到 critical。
 * 失败返回 null,由上层走 fail-safe。
 */

const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1/solana/token_security';

export interface GoPlusFlag {
  status: '0' | '1';
  authority?: { address: string; malicious_address?: number }[];
}

export interface GoPlusTransferFee {
  // 单位:bps?GoPlus 文档不同源说法不一,统一处理为 percent 字段
  fee_percent?: string | number;
  fee_rate?: string | number;
  fee?: string | number;
  maximum_fee?: string | number;
  scheduled_fees?: unknown;
}

export interface GoPlusTokenSecurity {
  metadata?: { name?: string; symbol?: string; uri?: string };
  // mint / freeze / close / balance_mutable 权限是否还在(status='1' 表示权限存在 = 风险)
  mintable?: GoPlusFlag;
  freezable?: GoPlusFlag;
  closable?: GoPlusFlag;
  balance_mutable_authority?: GoPlusFlag;
  // 转账特性
  non_transferable?: '0' | '1';
  transfer_fee?: GoPlusTransferFee;
  transfer_fee_upgradable?: GoPlusFlag;
  transfer_hook?: unknown[];
  transfer_hook_upgradable?: GoPlusFlag;
  default_account_state?: string;             // '0' freeze / '1' init
  default_account_state_upgradable?: GoPlusFlag;
  // metadata 是否可改(rug 项目改名换皮的常见手法)
  metadata_mutable?: { status?: '0' | '1'; metadata_upgrade_authority?: unknown[] };
  // GoPlus 维护的可信代币白名单(USDC / USDT / 主流 meme 等)
  trusted_token?: '0' | '1';
  // 持有者(可与 RugCheck 相互验证)
  holders?: { account: string; balance: string; percent: string; is_locked?: number }[];
  lp_holders?: { account: string; percent: string; is_locked?: number }[];
  creators?: { address: string; malicious_address?: number }[];
  // dex 池子(用于交叉验证流动性)
  dex?: { dex_name: string; type: string; price?: string; tvl?: string }[];
}

export interface GoPlusResponse {
  code: number;
  message: string;
  result?: Record<string, GoPlusTokenSecurity>;
}

/**
 * 拉取 GoPlus 安全报告。失败返回 null(不抛)。
 * 8s 超时 — 比 RugCheck 短,GoPlus 一般更快;失败也不阻断主流程。
 */
export async function fetchGoPlusReport(
  mint: string
): Promise<GoPlusTokenSecurity | null> {
  try {
    const url = `${GOPLUS_BASE}?contract_addresses=${mint}`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.warn(`[goplus] ${mint.slice(0, 8)}: HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as GoPlusResponse;
    if (json.code !== 1) {
      console.warn(`[goplus] ${mint.slice(0, 8)}: code=${json.code} ${json.message}`);
      return null;
    }
    // GoPlus 返回时 key 可能是大小写不一致的 mint;做个容错
    const result = json.result ?? {};
    const direct = result[mint];
    if (direct) return direct;
    const lower = result[mint.toLowerCase()];
    if (lower) return lower;
    const keys = Object.keys(result);
    if (keys.length === 1) return result[keys[0]] ?? null;
    return null;
  } catch (e) {
    console.warn(`[goplus] ${mint.slice(0, 8)}:`, e);
    return null;
  }
}

// ─── 派生指标 ───

/** 转账税(%)· 取 fee_percent / fee_rate / fee 任一可解析的;无则 0 */
export function transferFeePct(g: GoPlusTokenSecurity): number {
  const tf = g.transfer_fee;
  if (!tf) return 0;
  const raw = tf.fee_percent ?? tf.fee_rate ?? tf.fee;
  if (raw == null) return 0;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0) return 0;
  // GoPlus 在 Solana 上一般是百分比字符串("5" = 5%);保险起见 ≤1 视为小数
  return n <= 1 ? n * 100 : n;
}

/** 是否不可转(蜜罐核心特征之一) */
export function isNonTransferable(g: GoPlusTokenSecurity): boolean {
  return g.non_transferable === '1';
}

/** 权限是否还在(status='1' 表示权限未放弃 = 风险存在) */
export function isMintActive(g: GoPlusTokenSecurity): boolean {
  return g.mintable?.status === '1';
}
export function isFreezeActive(g: GoPlusTokenSecurity): boolean {
  return g.freezable?.status === '1';
}
export function isCloseActive(g: GoPlusTokenSecurity): boolean {
  return g.closable?.status === '1';
}
export function isBalanceMutable(g: GoPlusTokenSecurity): boolean {
  return g.balance_mutable_authority?.status === '1';
}

/** 创建者是否被标恶意地址 */
export function hasMaliciousCreator(g: GoPlusTokenSecurity): boolean {
  return (g.creators ?? []).some((c) => (c?.malicious_address ?? 0) > 0);
}

/** GoPlus 自己维护的可信白名单 */
export function isGoPlusTrusted(g: GoPlusTokenSecurity): boolean {
  return g.trusted_token === '1';
}
