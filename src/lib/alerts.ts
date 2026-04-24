/**
 * 价格提醒 · 本地存储 + 逻辑
 *
 * V1 纯前端:localStorage 持久化,浏览器开着才工作
 * V2 迁后端:相同接口,数据源换成 fetch('/api/alerts')
 */

const STORAGE_KEY = 'ocufi.alerts.v1';

export type AlertDirection = 'above' | 'below';

export interface PriceAlert {
  id: string;             // uuid
  mint: string;
  symbol: string;         // 创建时 snapshot,方便列表显示
  direction: AlertDirection;
  /** 目标价(USD),到这个价或穿越时触发 */
  targetUsd: number;
  /** 创建时的 priceUsd,用于判断"从哪边穿越"更友好(目前未用到) */
  createdPriceUsd: number;
  createdAt: number;
  /** 是否已触发(true 后不再推通知) */
  triggered: boolean;
  triggeredAt?: number;
  triggeredPriceUsd?: number;
}

export function loadAlerts(): PriceAlert[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: PriceAlert[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    /* quota full / private mode,静默 */
  }
}

export function addAlert(a: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>): PriceAlert {
  const all = loadAlerts();
  const alert: PriceAlert = {
    ...a,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    triggered: false,
  };
  all.unshift(alert);
  saveAlerts(all);
  return alert;
}

export function removeAlert(id: string): void {
  saveAlerts(loadAlerts().filter((a) => a.id !== id));
}

export function markTriggered(id: string, priceUsd: number): void {
  const all = loadAlerts();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    triggered: true,
    triggeredAt: Date.now(),
    triggeredPriceUsd: priceUsd,
  };
  saveAlerts(all);
}

/** 判断一个 alert 按当前价应不应该触发 */
export function shouldFire(alert: PriceAlert, currentPrice: number): boolean {
  if (alert.triggered) return false;
  if (alert.direction === 'above') return currentPrice >= alert.targetUsd;
  return currentPrice <= alert.targetUsd;
}

// ─── 浏览器 Notification ───

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function getNotifPermission(): NotifPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotifPermission;
}

export async function requestNotifPermission(): Promise<NotifPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const r = await Notification.requestPermission();
  return r as NotifPermission;
}

export function fireNotification(title: string, body: string, url?: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico' });
    if (url) n.onclick = () => window.open(url, '_blank');
  } catch {
    /* noop */
  }
}
