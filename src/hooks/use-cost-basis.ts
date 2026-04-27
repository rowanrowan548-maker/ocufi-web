'use client';

/**
 * 拉历史 tx → 算每个 mint 的加权平均成本
 */
import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { fetchTxHistory, type TxRecord } from '@/lib/tx-history';
import { computeCostBasis, type CostEntry } from '@/lib/cost-basis';

export interface CostBasisState {
  costs: Map<string, CostEntry>;
  loading: boolean;
  /** T-900c:暴露原始 tx 记录,view 用来按时间范围过滤计算区间内 buy/sell 笔数 */
  records: TxRecord[];
}

export function useCostBasis(): CostBasisState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [costs, setCosts] = useState<Map<string, CostEntry>>(new Map());
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setCosts(new Map());
      setRecords([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const recs = await fetchTxHistory(connection, publicKey, 100);
        if (cancelled) return;
        setRecords(recs);
        setCosts(computeCostBasis(recs));
      } catch {
        if (!cancelled) {
          setRecords([]);
          setCosts(new Map());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  return { costs, loading, records };
}
