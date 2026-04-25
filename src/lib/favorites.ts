/**
 * 自选代币 · localStorage 持久化
 *
 * 简单存 mint 字符串数组,按加入顺序排列(最新加入排前)
 *
 * 跨 tab 同步:监听 storage 事件,任一 tab 改自选其他 tab 实时更新
 */
import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'ocufi.favorites';
const STORAGE_EVENT = 'ocufi-favorites-changed';

function readStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 防 localStorage 被篡入怪东西:只保留合法 mint 长度
    return parsed
      .filter((s): s is string => typeof s === 'string' && s.length >= 32 && s.length <= 44)
      .slice(0, 200); // 上限 200 防意外膨胀
  } catch {
    return [];
  }
}

function writeStorage(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    // 通知同 tab 内其他 useFavorites 实例(storage 事件只跨 tab 触发)
    window.dispatchEvent(new Event(STORAGE_EVENT));
  } catch {
    /* localStorage 满 / 隐私模式禁用 */
  }
}

/** Hook: 响应式拿自选列表 + 操作方法 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(readStorage());
    const handler = () => setFavorites(readStorage());
    window.addEventListener('storage', handler);          // 跨 tab
    window.addEventListener(STORAGE_EVENT, handler);       // 同 tab
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(STORAGE_EVENT, handler);
    };
  }, []);

  const add = useCallback((mint: string) => {
    if (!mint || mint.length < 32 || mint.length > 44) return;
    const cur = readStorage();
    if (cur.includes(mint)) return;
    writeStorage([mint, ...cur]);
  }, []);

  const remove = useCallback((mint: string) => {
    const cur = readStorage();
    writeStorage(cur.filter((m) => m !== mint));
  }, []);

  const toggle = useCallback((mint: string) => {
    const cur = readStorage();
    if (cur.includes(mint)) writeStorage(cur.filter((m) => m !== mint));
    else writeStorage([mint, ...cur]);
  }, []);

  const isFavorite = useCallback(
    (mint: string) => favorites.includes(mint),
    [favorites]
  );

  return { favorites, add, remove, toggle, isFavorite };
}
