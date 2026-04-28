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
import { fetchHistoryEnriched, isApiConfigured } from '@/lib/api-client';

export interface EnrichedTxRecord extends TxRecord {
  tokenSymbol: string;
  tokenLogo?: string;
  // T-929-cont #91:从后端 /history 合并的扩展字段
  gasFeeSol?: number;
  priorityFeeSol?: number;
  executionPriceUsd?: number;     // V1 算 output / input 估算,V2 后端给真实值
  actualSlippageBps?: number;
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
        // 并行:Helius 分类 history + 后端 /history 扩展字段(后者可降级)
        const [raw, backendRecs] = await Promise.all([
          fetchTxHistory(connection, publicKey, limit),
          isApiConfigured()
            ? fetchHistoryEnriched(publicKey.toBase58(), limit).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelled) return;

        // 后端 by signature 索引,O(1) merge
        const backendBySig = new Map(backendRecs.map((b) => [b.tx_signature, b]));

        const mints = Array.from(
          new Set(raw.map((r) => r.tokenMint).filter(Boolean))
        );
        const infos = mints.length ? await fetchTokensInfoBatch(mints) : new Map();
        if (cancelled) return;

        const enriched: EnrichedTxRecord[] = raw.map((r) => {
          const info = r.tokenMint ? infos.get(r.tokenMint) : undefined;
          const b = backendBySig.get(r.signature);
          // 估算成交价:input_mint == SOL 时,output_amount / input_amount
          let executionPriceUsd: number | undefined;
          if (b && b.input_amount && b.output_amount && b.input_amount > 0) {
            // V1 简化:成交单位价 = output / input(单位由 mint 决定,UI 自行加单位)
            executionPriceUsd = b.output_amount / b.input_amount;
          }
          return {
            ...r,
            tokenSymbol: info?.symbol ?? (r.tokenMint ? r.tokenMint.slice(0, 6) : ''),
            tokenLogo: info?.logoUri,
            gasFeeSol: b?.gas_lamports != null ? b.gas_lamports / 1e9 : undefined,
            priorityFeeSol: b?.priority_fee_lamports != null ? b.priority_fee_lamports / 1e9 : undefined,
            executionPriceUsd,
            actualSlippageBps: b?.actual_slippage_bps ?? undefined,
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
