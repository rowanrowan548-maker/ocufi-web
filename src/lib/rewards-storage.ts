/**
 * T-REWARDS-PAGE · localStorage 跟踪累计奖励
 *
 * 两种奖励:
 *  - claimed:用户点"免费领取 SOL"批量 close 空 ATA · 押金返还(Tab 1)
 *  - mev:swap confirm 后实际 SOL diff 为正 · Helius backrun rebate(Tab 2)
 *
 * V1 纯前端 localStorage 存(后端不存)· 多设备不同步 · 清浏览器丢
 * V2 可挪后端 + 钱包签认证(目前不做 · 见 BACKLOG)
 */

const KEY_CLAIMED_TOTAL = 'ocufi.rewards.claimed_total_lamports';
const KEY_MEV_TOTAL = 'ocufi.rewards.mev_total_lamports';
const KEY_MEV_HISTORY = 'ocufi.rewards.mev_history';
const MAX_HISTORY = 200;

export interface MevEntry {
  /** swap tx signature */
  tx: string;
  /** SOL diff in lamports(正数 = 用户多到的) */
  amount_lamports: number;
  /** epoch ms */
  ts: number;
  /** swap 标的 token symbol(若知道)*/
  token_symbol?: string;
}

const isClient = () => typeof window !== 'undefined';

function readNumber(key: string): number {
  if (!isClient()) return 0;
  try {
    const v = window.localStorage.getItem(key);
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, n: number): void {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(key, String(Math.max(0, Math.floor(n))));
  } catch {
    // localStorage full / disabled · 静默
  }
}

export function getClaimedTotalLamports(): number {
  return readNumber(KEY_CLAIMED_TOTAL);
}

export function addClaimedLamports(delta: number): number {
  const n = getClaimedTotalLamports() + Math.max(0, Math.floor(delta));
  writeNumber(KEY_CLAIMED_TOTAL, n);
  return n;
}

export function getMevTotalLamports(): number {
  return readNumber(KEY_MEV_TOTAL);
}

// useSyncExternalStore 要求 snapshot 引用稳定 · raw string 不变 → 同 array 实例
const EMPTY_HISTORY: MevEntry[] = [];
let _mevHistoryRawCache: string | null = null;
let _mevHistoryParsedCache: MevEntry[] = EMPTY_HISTORY;

export function getMevHistory(): MevEntry[] {
  if (!isClient()) return EMPTY_HISTORY;
  try {
    const raw = window.localStorage.getItem(KEY_MEV_HISTORY);
    if (!raw) {
      _mevHistoryRawCache = null;
      _mevHistoryParsedCache = EMPTY_HISTORY;
      return EMPTY_HISTORY;
    }
    if (raw === _mevHistoryRawCache) return _mevHistoryParsedCache;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      _mevHistoryRawCache = null;
      _mevHistoryParsedCache = EMPTY_HISTORY;
      return EMPTY_HISTORY;
    }
    _mevHistoryRawCache = raw;
    _mevHistoryParsedCache = parsed.filter(isValidMevEntry);
    return _mevHistoryParsedCache;
  } catch {
    return EMPTY_HISTORY;
  }
}

function isValidMevEntry(x: unknown): x is MevEntry {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.tx === 'string' &&
    typeof o.amount_lamports === 'number' &&
    typeof o.ts === 'number'
  );
}

/** 写一条 MEV 记录 · 自动累加 total · 自动裁剪到 MAX_HISTORY */
export function pushMevEntry(entry: MevEntry): void {
  if (!isClient()) return;
  if (!entry.tx || entry.amount_lamports <= 0) return;

  // 防 dup(同 tx 多次记 · swap progress 多回调)
  const list = getMevHistory();
  if (list.some((e) => e.tx === entry.tx)) return;

  list.unshift(entry);
  const trimmed = list.slice(0, MAX_HISTORY);
  try {
    window.localStorage.setItem(KEY_MEV_HISTORY, JSON.stringify(trimmed));
  } catch {
    return;
  }
  writeNumber(KEY_MEV_TOTAL, getMevTotalLamports() + entry.amount_lamports);
}

/** 累计回收(claimed + mev)· 显在奖励中心顶部 */
export function getRewardsTotalLamports(): number {
  return getClaimedTotalLamports() + getMevTotalLamports();
}
