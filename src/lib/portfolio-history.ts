/**
 * 持仓总值快照(localStorage)
 *
 * 思路:V1 没有后端历史 API,前端每次打开 portfolio 页就在 localStorage 写一条
 *      {ts, totalUsd}。同一钱包用一段时间后即可绘出 7d / 30d 曲线。
 *
 * 节流:同一小时内只记一次,避免页面反复刷新刷脏数据
 * 上限:90 天 × 24 = 2160 条,旧数据自动裁掉
 *
 * 不存到后端是有意为之 — 持仓金额是隐私,前端单机存,不上送
 */
const PREFIX = 'ocufi.portfolio.history.';
const HOUR_MS = 3600_000;
const MAX_AGE_MS = 90 * 24 * HOUR_MS;
const MAX_POINTS = 90 * 24;

export interface Snapshot {
  ts: number;       // ms
  totalUsd: number;
}

function key(wallet: string): string {
  return `${PREFIX}${wallet}`;
}

export function readSnapshots(wallet: string): Snapshot[] {
  if (typeof window === 'undefined' || !wallet) return [];
  try {
    const raw = window.localStorage.getItem(key(wallet));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter(
        (p): p is Snapshot =>
          p && typeof p.ts === 'number' && typeof p.totalUsd === 'number' &&
          p.ts > 0 && p.ts <= now && Number.isFinite(p.totalUsd)
      )
      .filter((p) => now - p.ts <= MAX_AGE_MS)
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

/**
 * 追加一条快照。同一小时内已经写过则跳过(防短时刷新刷脏数据)
 * 返回最终的快照列表
 */
export function appendSnapshot(wallet: string, totalUsd: number): Snapshot[] {
  if (typeof window === 'undefined' || !wallet) return [];
  if (!Number.isFinite(totalUsd) || totalUsd < 0) return readSnapshots(wallet);

  const list = readSnapshots(wallet);
  const now = Date.now();
  const last = list[list.length - 1];
  if (last && now - last.ts < HOUR_MS) {
    // 同一小时内只更新最近一条(覆盖,避免空值或闪存)
    list[list.length - 1] = { ts: last.ts, totalUsd };
  } else {
    list.push({ ts: now, totalUsd });
  }
  // 裁剪
  while (list.length > MAX_POINTS) list.shift();
  try {
    window.localStorage.setItem(key(wallet), JSON.stringify(list));
  } catch {
    /* 满了 / 隐私模式 */
  }
  return list;
}

/** 取过去 N 天的快照 */
export function snapshotsInRange(list: Snapshot[], days: number): Snapshot[] {
  const cutoff = Date.now() - days * 24 * HOUR_MS;
  return list.filter((p) => p.ts >= cutoff);
}
