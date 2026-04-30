'use client';

/**
 * T-PHANTOM-SPLIT-TX-FE · wrap cleanup 逃生口
 *
 * 场景:split 模式 setup 已上链(用户钱包多了 wrapped SOL)· 但 swap 失败 · 用户钱包里有
 * 一笔锁住的 WSOL ATA。用户下次进 trade 页 · 弹 toast 提示"上次有未完成 wrap"
 * + Solscan 链接 · 让他自己去 Phantom / Solscan / 手动 unwrap。
 *
 * V1 仅通知 + Solscan 链接(spec 明示)· 后续 V2 可加一键 unwrap 按钮(需 @solana/spl-token)
 */

const KEY = 'ocufi.pendingWrap';

interface PendingWrap {
  setupSig: string;
  ts: number;       // unix sec · 24h 后自动过期(防 toast 永远显)
  mint: string;     // 哪个 token 触发的 split
}

export function markPendingWrap(setupSig: string, mint: string): void {
  if (typeof window === 'undefined') return;
  const data: PendingWrap = { setupSig, ts: Math.floor(Date.now() / 1000), mint };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* localStorage 满 / 隐私模式 · 忽略 */
  }
}

export function clearPendingWrap(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 读未完成 wrap · 24h 内才返(防 toast 永远显)
 * 过期或不存在 → null
 */
export function readPendingWrap(): PendingWrap | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingWrap;
    if (!parsed.setupSig || !parsed.ts) return null;
    const ageSec = Math.floor(Date.now() / 1000) - parsed.ts;
    if (ageSec > 24 * 3600) {
      // 超 24h · 自清
      try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
