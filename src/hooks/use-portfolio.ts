'use client';

/**
 * 聚合整个钱包的持仓数据
 * 用法:
 *   const { sol, tokens, totalUsd, loading, error, refresh } = usePortfolio();
 */
import { useCallback, useEffect, useState } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  fetchWalletTokens,
  fetchTokensInfoBatch,
  fetchSolUsdPrice,
  type TokenInfo,
} from '@/lib/portfolio';

export interface PortfolioToken {
  mint: string;
  amount: number;        // 数量
  decimals: number;
  symbol: string;
  name: string;
  priceUsd: number;
  valueUsd: number;      // amount * priceUsd
  logoUri?: string;
  liquidityUsd: number;  // 信心指标
  marketCap: number;
}

export interface PortfolioState {
  sol: { amount: number; valueUsd: number };
  tokens: PortfolioToken[];
  totalUsd: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const REFRESH_MS = 30_000;

export function usePortfolio(): PortfolioState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [state, setState] = useState<Omit<PortfolioState, 'refresh'>>({
    sol: { amount: 0, valueUsd: 0 },
    tokens: [],
    totalUsd: 0,
    loading: false,
    error: null,
  });
  const [tick, setTick] = useState(0);   // 手动刷新触发

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!publicKey) {
      setState({
        sol: { amount: 0, valueUsd: 0 },
        tokens: [],
        totalUsd: 0,
        loading: false,
        error: null,
      });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      if (cancelled) return;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        // 并行:SOL 余额 + 钱包 SPL token 列表 + SOL 美元价
        const [lamports, walletTokens, solUsd] = await Promise.all([
          connection.getBalance(publicKey, 'confirmed'),
          fetchWalletTokens(connection, publicKey),
          fetchSolUsdPrice(),
        ]);
        if (cancelled) return;

        const solAmount = lamports / LAMPORTS_PER_SOL;
        const solValueUsd = solAmount * solUsd;

        // 查每个 token 的价格/符号
        const infos = walletTokens.length
          ? await fetchTokensInfoBatch(walletTokens.map((t) => t.mint))
          : new Map<string, TokenInfo>();
        if (cancelled) return;

        const tokens: PortfolioToken[] = walletTokens.map((wt) => {
          const info = infos.get(wt.mint);
          const priceUsd = info?.priceUsd ?? 0;
          return {
            mint: wt.mint,
            amount: wt.amount,
            decimals: wt.decimals,
            symbol: info?.symbol ?? wt.mint.slice(0, 6),
            name: info?.name ?? '',
            priceUsd,
            valueUsd: wt.amount * priceUsd,
            logoUri: info?.logoUri,
            liquidityUsd: info?.liquidityUsd ?? 0,
            marketCap: info?.marketCap ?? 0,
          };
        });

        // 按价值降序
        tokens.sort((a, b) => b.valueUsd - a.valueUsd);

        const totalUsd = solValueUsd + tokens.reduce((s, t) => s + t.valueUsd, 0);

        setState({
          sol: { amount: solAmount, valueUsd: solValueUsd },
          tokens,
          totalUsd,
          loading: false,
          error: null,
        });
      } catch (e: unknown) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
      if (!cancelled) timer = setTimeout(load, REFRESH_MS);
    };
    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [publicKey, connection, tick]);

  return { ...state, refresh };
}
