'use client';

/**
 * 读钱包里某 SPL Token 的余额
 *
 * 用 getParsedTokenAccountsByOwner 按 mint filter,汇总所有 ATA(通常只有 1 个)
 * 30s 轮询,mint 或钱包改变时自动重拉
 */
import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

export interface TokenBalanceState {
  amount: number | null;        // uiAmount(可能有浮点损失,适合显示)
  /** 原始链上 raw amount(string,精确);卖 100% 用这个避开浮点误差 */
  rawAmount: string | null;
  decimals: number | null;
  loading: boolean;
  error: string | null;
}

export function useTokenBalance(mint: string | null): TokenBalanceState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [state, setState] = useState<TokenBalanceState>({
    amount: null,
    rawAmount: null,
    decimals: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!mint || !publicKey) {
      setState({ amount: null, rawAmount: null, decimals: null, loading: false, error: null });
      return;
    }
    // 先简单校验 mint 格式;无效不查
    let mintPk: PublicKey;
    try {
      mintPk = new PublicKey(mint);
    } catch {
      setState({ amount: null, rawAmount: null, decimals: null, loading: false, error: null });
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
    fetchBal();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mint, publicKey, connection]);

  return state;
}
