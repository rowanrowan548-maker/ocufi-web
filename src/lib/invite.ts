/**
 * 邀请系统 · 前端工具
 *
 * 邀请码:钱包地址 SHA-256 前 30 bit → 6 字符 base32(Crockford 风格,去掉 i/l/o/u 易混字符)
 * 同钱包永远生成同一邀请码,前端可算,后端 InviteRelation 表不必存 inviter_code
 *
 * URL ref 捕获:首次 ?ref=xxx 进站,localStorage 暂存,首次连钱包绑定时上送
 */

// Crockford base32 去 I/L/O/U,共 32 字符
const ALPHABET = 'abcdefghjkmnpqrstvwxyz0123456789';
const REF_KEY = 'ocufi.invite.pendingRef';
const SELF_KEY = 'ocufi.invite.myCode';

/** 异步生成邀请码(SHA-256) */
export async function inviteCodeFor(walletAddress: string): Promise<string> {
  if (!walletAddress || typeof crypto === 'undefined' || !crypto.subtle) return '';
  const data = new TextEncoder().encode(walletAddress);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hash = new Uint8Array(hashBuf);
  // 取前 4 byte 拼成 30 bit,余 2 bit 丢
  const v =
    ((hash[0] & 0xff) << 22) |
    ((hash[1] & 0xff) << 14) |
    ((hash[2] & 0xff) << 6) |
    ((hash[3] & 0xff) >> 2);
  let out = '';
  for (let i = 5; i >= 0; i--) {
    out += ALPHABET[(v >>> (5 * i)) & 0x1f];
  }
  return out;
}

/** 校验邀请码格式 */
export function isValidInviteCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  return /^[a-z0-9]{6}$/i.test(code) &&
    code.toLowerCase().split('').every((c) => ALPHABET.includes(c));
}

/** 从 URL 捕获 ?ref=xxx,localStorage 暂存(已存在则不覆盖) */
export function captureRefFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get('ref') ?? '').trim().toLowerCase();
    if (!ref || !isValidInviteCode(ref)) return null;
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
