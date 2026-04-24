'use client';

/**
 * 拉历史 tx → 算每个 mint 的加权平均成本
 */
import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { fetchTxHistory } from '@/lib/tx-history';
import { computeCostBasis, type CostEntry } from '@/lib/cost-basis';

export interface CostBasisState {
  costs: Map<string, CostEntry>;
  loading: boolean;
}

export function useCostBasis(): CostBasisState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [costs, setCosts] = useState<Map<string, CostEntry>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setCosts(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const records = await fetchTxHistory(connection, publicKey, 100);
        if (cancelled) return;
        setCosts(computeCostBasis(records));
      } catch {
        if (!cancelled) setCosts(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  return { costs, loading };
}
