'use client';

/**
 * 读钱包里某 SPL Token 的余额
 *
 * 用 getParsedTokenAccountsByOwner 按 mint filter,汇总所有 ATA(通常只有 1 个)
 * 30s 轮询,mint 或钱包改变时自动重拉。可选 refetch() 主动重拉。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

export interface TokenBalanceState {
  amount: number | null;        // uiAmount(可能有浮点损失,适合显示)
  /** 原始链上 raw amount(string,精确);卖 100% 用这个避开浮点误差 */
  rawAmount: string | null;
  decimals: number | null;
  loading: boolean;
  error: string | null;
  /** 主动重拉余额(前端可在交易确认前调一次,补强 30s 轮询的竞态) */
  refetch: () => Promise<void>;
}

const NOOP_REFETCH = async () => {};

export function useTokenBalance(mint: string | null): TokenBalanceState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [state, setState] = useState<Omit<TokenBalanceState, 'refetch'>>({
    amount: null,
    rawAmount: null,
    decimals: null,
    loading: false,
    error: null,
  });
  // refetchRef 让外部 refetch() 总是调到当前 effect 内的 fetchBal,
  // 避免 stale closure 在 mint/publicKey 改变后还查老的
  const refetchRef = useRef<() => Promise<void>>(NOOP_REFETCH);

  useEffect(() => {
    if (!mint || !publicKey) {
      setState({ amount: null, rawAmount: null, decimals: null, loading: false, error: null });
      refetchRef.current = NOOP_REFETCH;
      return;
    }
    let mintPk: PublicKey;
    try {
      mintPk = new PublicKey(mint);
    } catch {
      setState({ amount: null, rawAmount: null, decimals: null, loading: false, error: null });
      refetchRef.current = NOOP_REFETCH;
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchBal = async () => {
      if (cancelled) return;
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: mintPk,
        });
        if (cancelled) return;
        let total = 0;
        let totalRaw = BigInt(0);
        let decimals: number | null = null;
        for (const acc of res.value) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const info: any = acc.account.data;
          const amt = info?.parsed?.info?.tokenAmount;
          if (amt) {
            total += Number(amt.uiAmount ?? 0);
            totalRaw += BigInt(String(amt.amount ?? '0'));
            decimals = Number(amt.decimals ?? 0);
          }
        }
        setState({
          amount: total,
          rawAmount: totalRaw.toString(),
          decimals,
          loading: false,
          error: null,
        });
      } catch (e: unknown) {
        if (cancelled) return;
        setState({
          amount: null,
          rawAmount: null,
          decimals: null,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      if (!cancelled) timer = setTimeout(fetchBal, 30_000);
    };

    refetchRef.current = async () => {
      // 主动 refetch 时清掉排队中的 30s 轮询,避免短时间内并发两次
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await fetchBal();
    };

    fetchBal();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      refetchRef.current = NOOP_REFETCH;
    };
  }, [mint, publicKey, connection]);

  const refetch = useCallback(() => refetchRef.current(), []);

  return { ...state, refetch };
}
