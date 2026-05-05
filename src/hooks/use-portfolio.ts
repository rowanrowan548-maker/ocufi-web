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
  fetchSolUsdPrice,
  SOL_MINT,
} from '@/lib/portfolio';
import {
  fetchPortfolioHoldings,
  isApiConfigured,
  type HoldingItem,
} from '@/lib/api-client';
import { useSwapRefresh } from '@/lib/swap-refresh-store';

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
  // T-PORTFOLIO-AUTOREFRESH · swap 成交后由 buy/sell-form 调 bumpSwap()
  // swapVersion 变 → 下面的 useEffect 重新 load(等同 refresh)
  const swapVersion = useSwapRefresh((s) => s.swapVersion);

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
        // 并行:SOL 余额(链上) + 后端持仓列表 + SOL 美元价
        const [lamports, holdings, solUsd] = await Promise.all([
          connection.getBalance(publicKey, 'confirmed'),
          isApiConfigured()
            ? fetchPortfolioHoldings(publicKey.toBase58())
            : Promise.resolve({ ok: false, items: [] as HoldingItem[] }),
          fetchSolUsdPrice(),
        ]);
        if (cancelled) return;

        // T-PF-129 · WSOL 余额并入 SOL 显示 · WSOL 不单独占行
        // P3-FE-5 · 字段名跟后端 camelCase 对齐
        const wsolItem = holdings.items.find((i) => i.mint === SOL_MINT);
        const wsolAmount = wsolItem?.uiAmount ?? 0;
        const nonWsolItems = holdings.items.filter((i) => i.mint !== SOL_MINT);

        const nativeSolAmount = lamports / LAMPORTS_PER_SOL;
        const solAmount = nativeSolAmount + wsolAmount;
        const solValueUsd = solAmount * solUsd;

        const tokens: PortfolioToken[] = nonWsolItems
          .filter((i) => i.uiAmount > 0)
          .map((i) => ({
            mint: i.mint,
            amount: i.uiAmount,
            decimals: i.decimals,
            symbol: i.symbol || i.mint.slice(0, 6),
            name: i.name || '',
            priceUsd: i.priceUsd ?? 0,
            valueUsd: i.valueUsd ?? 0,
            logoUri: i.logoURI ?? undefined,
            liquidityUsd: 0,
            marketCap: 0,
          }));

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
  }, [publicKey, connection, tick, swapVersion]);

  return { ...state, refresh };
}
