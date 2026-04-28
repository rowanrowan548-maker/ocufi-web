/**
 * 邀请系统 · 前端工具
 *
 * T-945 #110 · 邀请码升级 v2:8 字符大写字母+数字(28 字符表去 0/O/I/L/1)· hash 前 40 bit
 * v1 legacy:6 字符小写 base32(Crockford 风格,去 i/l/o/u 易混)· hash 前 30 bit
 *
 * 兼容:
 * - inviteCodeFor() 默认生成 v2(对外)
 * - isValidInviteCode() 同时接受 v1 / v2
 * - 后端 services/invite_code.py 同步实现,bind 时 normalize → v2 大写 / v1 小写
 *
 * URL ref 捕获:首次 ?ref=xxx 进站,localStorage 暂存,首次连钱包绑定时上送
 */

// v1 · 6 字符 · Crockford 风格小写
const ALPHABET_V1 = 'abcdefghjkmnpqrstvwxyz0123456789';
const LENGTH_V1 = 6;

// v2 · 8 字符 · 大写 + 数字 · 去 0/O/I/L/1(28 字符)
const ALPHABET_V2 = 'BCDFGHJKMNPQRSTVWXYZ23456789';
const LENGTH_V2 = 8;

const REF_KEY = 'ocufi.invite.pendingRef';
const SELF_KEY = 'ocufi.invite.myCode';

/** 异步生成邀请码(SHA-256)· 默认 v2 8 字符 */
export async function inviteCodeFor(
  walletAddress: string,
  version: 1 | 2 = 2,
): Promise<string> {
  if (!walletAddress || typeof crypto === 'undefined' || !crypto.subtle) return '';
  const data = new TextEncoder().encode(walletAddress);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hash = new Uint8Array(hashBuf);
  if (version === 1) return encodeV1(hash);
  return encodeV2(hash);
}

/** v1 · 前 30 bit → 6 字符 base32 */
function encodeV1(hash: Uint8Array): string {
  const v =
    ((hash[0] & 0xff) << 22) |
    ((hash[1] & 0xff) << 14) |
    ((hash[2] & 0xff) << 6) |
    ((hash[3] & 0xff) >> 2);
  let out = '';
  for (let i = 5; i >= 0; i--) {
    out += ALPHABET_V1[(v >>> (5 * i)) & 0x1f];
  }
  return out;
}

/** v2 · 前 40 bit → 8 字符 base28
 * 40 bit 安全在 Number 的 53 bit 精度内,用 (hi*2^32 + lo) 凑数 · 避免 BigInt(target ES2017) */
function encodeV2(hash: Uint8Array): string {
  // hi = byte 0 (8 bit), lo = byte 1..4 (32 bit)
  const hi = hash[0] & 0xff;
  const lo =
    ((hash[1] & 0xff) * 0x1000000) +
    ((hash[2] & 0xff) << 16) +
    ((hash[3] & 0xff) << 8) +
    (hash[4] & 0xff);
  // 总值 = hi * 2^32 + lo · 在 53 bit safe int 内
  let v = hi * 0x100000000 + lo;
  const base = ALPHABET_V2.length; // 28
  let out = '';
  for (let i = 0; i < LENGTH_V2; i++) {
    out = ALPHABET_V2[v % base] + out;
    v = Math.floor(v / base);
  }
  return out;
}

/** 校验邀请码格式 · 同时接受 v1 / v2 */
export function isValidInviteCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  const n = code.length;
  if (n === LENGTH_V2) return [...code].every((c) => ALPHABET_V2.includes(c));
  if (n === LENGTH_V1) return [...code.toLowerCase()].every((c) => ALPHABET_V1.includes(c));
  return false;
}

/** 标准化输入:8 → 大写,6 → 小写,其他长度原样返(校验仍会失败) */
export function normalizeInviteCode(code: string): string {
  if (typeof code !== 'string') return '';
  const s = code.trim();
  if (s.length === LENGTH_V2) return s.toUpperCase();
  if (s.length === LENGTH_V1) return s.toLowerCase();
  return s;
}

/** 从 URL 捕获 ?ref=xxx,localStorage 暂存(已存在则不覆盖) */
export function captureRefFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('ref') ?? '').trim();
    if (!raw) return null;
    const ref = normalizeInviteCode(raw);
    if (!isValidInviteCode(ref)) return null;
    const existing = window.localStorage.getItem(REF_KEY);
    if (existing) return existing; // 不覆盖,首推优先
    window.localStorage.setItem(REF_KEY, ref);
    return ref;
  } catch {
    return null;
  }
}

export function getPendingRef(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

export function clearPendingRef(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(REF_KEY);
  } catch { /* */ }
}

/** 缓存自己的邀请码(避免每次重算 SHA-256) */
export function cacheMyCode(wallet: string, code: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SELF_KEY, JSON.stringify({ wallet, code }));
  } catch { /* */ }
}

export function readCachedMyCode(wallet: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SELF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.wallet === wallet ? parsed.code : null;
  } catch {
    return null;
  }
}

/** 拼分享 URL */
export function buildInviteUrl(code: string, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://ocufi.io');
  return `${base}/?ref=${code}`;
}
