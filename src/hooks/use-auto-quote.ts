'use client';

/**
 * 自动报价 hook
 *
 * 输入合法时:
 *   1. 防抖 500ms 后第一次拉报价
 *   2. 拉到后倒计时 N 秒,到点自动 refetch
 *   3. 用户改输入 → 取消旧 timer + 重新走 1
 *
 * 不合法 → 清空 quote,空闲
 */
import { useEffect, useRef, useState } from 'react';
import { getQuote, type JupiterQuote, type QuoteOptions } from '@/lib/jupiter';

const DEBOUNCE_MS = 500;
const REFRESH_SEC = 8;        // 8 秒重查,留出余量(Jupiter 报价 ~1s 延迟)

export interface AutoQuoteParams {
  /** 输入合法时才查;不合法/空时返回 idle */
  enabled: boolean;
  inputMint: string;
  outputMint: string;
  /** raw amount (含 decimals) */
  amountRaw: bigint | string | number | null;
  options?: QuoteOptions;
}

export type AutoQuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; quote: JupiterQuote; refreshIn: number; fetchedAt: number }
  | { status: 'error'; error: string };

export function useAutoQuote(params: AutoQuoteParams): AutoQuoteState {
  const [state, setState] = useState<AutoQuoteState>({ status: 'idle' });
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (
      !params.enabled ||
      !params.inputMint ||
      !params.outputMint ||
      params.inputMint === params.outputMint ||
      !params.amountRaw ||
      BigInt(params.amountRaw.toString()) <= BigInt(0)
    ) {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const myReqId = ++reqIdRef.current;

    const startCountdown = (initial: number, then: () => void) => {
      let n = initial;
      setState((s) => (s.status === 'ok' ? { ...s, refreshIn: n } : s));
      countdownTimer = setInterval(() => {
        if (cancelled) return;
        n -= 1;
        setState((s) => (s.status === 'ok' ? { ...s, refreshIn: n } : s));
        if (n <= 0) {
          if (countdownTimer) clearInterval(countdownTimer);
          countdownTimer = null;
          then();
        }
      }, 1000);
    };

    const fetchOnce = async () => {
      if (cancelled) return;
      // 第一次:loading;后续刷新:保持 ok 但更新 quote
      setState((s) => (s.status === 'ok' ? s : { status: 'loading' }));
      try {
        const q = await getQuote(
          params.inputMint,
          params.outputMint,
          params.amountRaw!,
          params.options ?? {}
        );
        if (cancelled || reqIdRef.current !== myReqId) return;
        setState({
          status: 'ok',
          quote: q,
          refreshIn: REFRESH_SEC,
          fetchedAt: Date.now(),
        });
        startCountdown(REFRESH_SEC, () => {
          if (!cancelled) fetchOnce();
        });
      } catch (e: unknown) {
        if (cancelled || reqIdRef.current !== myReqId) return;
        setState({
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
        });
        // 失败 3 秒后重试
        refetchTimer = setTimeout(() => {
          if (!cancelled) fetchOnce();
        }, 3000);
      }
    };

    // 防抖
    const debounceTimer = setTimeout(fetchOnce, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      if (countdownTimer) clearInterval(countdownTimer);
      if (refetchTimer) clearTimeout(refetchTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.enabled,
    params.inputMint,
    params.outputMint,
    params.amountRaw?.toString(),
    params.options?.slippageBps,
    params.options?.platformFeeBps,
  ]);

  return state;
}
