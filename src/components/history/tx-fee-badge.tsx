'use client';

/**
 * T-HISTORY-CHAIN-DETAIL-FE · /history 表"优先费 + Gas"列懒加载组件
 *
 * 模块级缓存 + inflight dedup · 同 signature 跨字段共享 1 次后端请求
 * IO rootMargin 200px · 进视口才调 /portfolio/tx-detail?signature=X
 *
 * 失败 / not_found → '—'
 * 加载中 → 灰色占位(防列宽抖)
 *
 * 配额保护:
 *   - 用户滚到才调 · 大部分行不调
 *   - 后端 1h cache + 前端模块缓存 = 同 sig 只调 1 次
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchTxDetail, isApiConfigured, type TxDetail } from '@/lib/api-client';

type Field = 'priority' | 'gas';

interface Props {
  signature: string;
  field: Field;
}

const cache = new Map<string, TxDetail | 'error'>();
const inflight = new Map<string, Promise<TxDetail | 'error'>>();

function getDetail(sig: string): Promise<TxDetail | 'error'> {
  const c = cache.get(sig);
  if (c) return Promise.resolve(c);
  let p = inflight.get(sig);
  if (!p) {
    p = fetchTxDetail(sig)
      .then((d) => { cache.set(sig, d); return d as TxDetail | 'error'; })
      .catch(() => { cache.set(sig, 'error'); return 'error' as const; })
      .finally(() => { inflight.delete(sig); });
    inflight.set(sig, p);
  }
  return p;
}

export function TxFeeBadge({ signature, field }: Props) {
  const t = useTranslations('history');
  const ref = useRef<HTMLSpanElement>(null);
  const [data, setData] = useState<TxDetail | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!signature || !isApiConfigured()) return;
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    let triggered = false;

    const fire = () => {
      if (triggered) return;
      triggered = true;
      getDetail(signature).then((r) => {
        if (cancelled) return;
        if (r === 'error') setErrored(true);
        else setData(r);
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      fire();
      return () => { cancelled = true; };
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { fire(); io.disconnect(); break; }
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [signature]);

  // not_found / 失败 / ok=false → 显 — · 不打扰
  const noData =
    errored || (data && (!data.ok || (field === 'priority' ? data.priority_fee_sol : data.base_fee_sol) <= 0));

  return (
    <span
      ref={ref}
      data-testid={`tx-fee-${field}`}
      data-sig={signature}
      data-state={data ? 'loaded' : errored ? 'error' : 'loading'}
      className="inline-block min-w-[40px]"
    >
      {!data && !errored ? (
        <span
          className="inline-block h-2 w-10 rounded bg-muted/40 animate-pulse"
          aria-label={t(field === 'priority' ? 'priorityFee.loading' : 'gas.loading')}
        />
      ) : noData ? (
        <span aria-label={t('fee.unknown')}>—</span>
      ) : (
        <span>{trimZeros((field === 'priority' ? data!.priority_fee_sol : data!.base_fee_sol).toFixed(8))}</span>
      )}
    </span>
  );
}

/** 0.000277648 → '0.000277648' · 0.00500000 → '0.005' · 0 → '0' */
function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '');
}
