'use client';

/**
 * 钱包连接 → 邀请关系绑定
 *
 * 钱包首次出现 publicKey 时:
 *  1. 调 /invite/register 把自己 (address, code) 注册到反查表(每钱包只跑一次,localStorage 标记)
 *  2. 检查 localStorage 是否有 pendingRef → 调 /invite/bind 绑定
 *  3. 绑定结果(成功 / 已绑过 / 自邀)→ localStorage 记一笔,不再重试
 *
 * 静默执行,无 UI;失败不打扰用户
 */
import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  bindInvite, registerInviteCode, isApiConfigured,
} from '@/lib/api-client';
import { getPendingRef, clearPendingRef } from '@/lib/invite';

const REGISTERED_KEY = 'ocufi.invite.registered';
const BOUND_KEY = 'ocufi.invite.bindResult';

function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function addToSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = readSet(key);
    set.add(value);
    window.localStorage.setItem(key, JSON.stringify([...set].slice(-50)));
  } catch { /* */ }
}

export function WalletBind() {
  const { publicKey } = useWallet();

  useEffect(() => {
    if (!publicKey) return;
    if (!isApiConfigured()) return;

    const addr = publicKey.toBase58();

    (async () => {
      // 1) 注册自己的 code(每钱包只一次)
      const registered = readSet(REGISTERED_KEY);
      if (!registered.has(addr)) {
        try {
          await registerInviteCode(addr);
          addToSet(REGISTERED_KEY, addr);
        } catch (e) {
          // 后端不可用就静默退出,下次再试
          console.warn('[invite] register failed', e);
          return;
        }
      }

      // 2) 有 pendingRef 就尝试绑定(每钱包只一次,绑过就清)
      const ref = getPendingRef();
      if (!ref) return;
      const bound = readSet(BOUND_KEY);
      if (bound.has(addr)) {
        clearPendingRef();
        return;
      }
      try {
        const r = await bindInvite(ref, addr);
        addToSet(BOUND_KEY, addr);
        clearPendingRef();
        console.info('[invite] bind:', r.reason);
      } catch (e) {
        console.warn('[invite] bind failed', e);
      }
    })();
  }, [publicKey]);

  return null;
}
