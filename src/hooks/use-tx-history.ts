'use client';

/**
 * 拉取钱包最近交易历史 + 补齐 token 符号/图标
 * 用法:
 *   const { records, loading, error, refresh } = useTxHistory(50);
 */
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { fetchTxHistory, type TxRecord } from '@/lib/tx-history';
import { fetchTokensInfoBatch } from '@/lib/portfolio';

export interface EnrichedTxRecord extends TxRecord {
  tokenSymbol: string;
  tokenLogo?: string;
}

export interface TxHistoryState {
  records: EnrichedTxRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTxHistory(limit = 100): TxHistoryState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [state, setState] = useState<Omit<TxHistoryState, 'refresh'>>({
    records: [],
    loading: false,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!publicKey) {
      setState({ records: [], loading: false, error: null });
      return;
    }
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const raw = await fetchTxHistory(connection, publicKey, limit);
        if (cancelled) return;

        const mints = Array.from(
          new Set(raw.map((r) => r.tokenMint).filter(Boolean))
        );
        const infos = mints.length ? await fetchTokensInfoBatch(mints) : new Map();
        if (cancelled) return;

        const enriched: EnrichedTxRecord[] = raw.map((r) => {
          const info = r.tokenMint ? infos.get(r.tokenMint) : undefined;
          return {
            ...r,
            tokenSymbol: info?.symbol ?? (r.tokenMint ? r.tokenMint.slice(0, 6) : ''),
            tokenLogo: info?.logoUri,
          };
        });

        setState({ records: enriched, loading: false, error: null });
      } catch (e: unknown) {
        if (cancelled) return;
        setState({
          records: [],
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicKey, connection, limit, tick]);

  return { ...state, refresh };
}
