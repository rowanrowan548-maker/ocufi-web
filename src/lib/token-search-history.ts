'use client';

/**
 * T-943 #62 · 最近查询历史 · localStorage 10 条
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'ocufi.tokenSearchHistory';
const EVENT = 'ocufi-tsh-changed';
const MAX = 10;

export interface SearchEntry {
  mint: string;
  symbol?: string;
  ts: number; // ms
}

function read(): SearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is SearchEntry =>
        e && typeof e.mint === 'string' && e.mint.length >= 32 && e.mint.length <= 44,
    ).slice(0, MAX);
  } catch { return []; }
}

function write(list: SearchEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* */ }
}

export function useSearchHistory() {
  const [list, setList] = useState<SearchEntry[]>([]);

  useEffect(() => {
    setList(read());
    const handler = () => setList(read());
    window.addEventListener('storage', handler);
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(EVENT, handler);
    };
  }, []);

  const add = useCallback((mint: string, symbol?: string) => {
    if (!mint || mint.length < 32 || mint.length > 44) return;
    const cur = read();
    const next: SearchEntry[] = [
      { mint, symbol, ts: Date.now() },
      ...cur.filter((e) => e.mint !== mint),
    ];
    write(next);
  }, []);

  const clear = useCallback(() => {
    write([]);
  }, []);

  return { list, add, clear };
}
