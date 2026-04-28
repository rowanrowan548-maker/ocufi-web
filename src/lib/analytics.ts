/**
 * 轻量埋点
 *
 * V1 只做两件事:
 * 1. 所有事件打到 console(本地开发/排查用)
 * 2. 如果浏览器里有 window.plausible(Plausible 脚本,后续接)— 透传一份
 *
 * 不做:GA、不收集任何 PII(钱包地址会做短截)
 * 未来要接后端自有统计:在这里加 fetch('/api/track', ...)
 */

export type AnalyticsEvent =
  | 'page_view'
  | 'wallet_connect'
  | 'wallet_disconnect'
  | 'swap_quote_requested'
  | 'swap_success'
  | 'swap_failure'
  | 'token_safety_view'
  | 'history_view'
  | 'limit_order_requested'
  | 'limit_order_created'
  | 'limit_order_failed'
  | 'limit_order_cancelled'
  | 'price_alert_created'
  | 'price_alert_triggered'
  | 'price_alert_deleted'
  | 'price_alert_toggled'
  | 'faq_feedback';

export interface TrackProps {
  [k: string]: string | number | boolean | null | undefined;
}

export function track(event: AnalyticsEvent, props: TrackProps = {}): void {
  const payload = { event, ts: Date.now(), ...scrub(props) };

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[analytics]', payload);
  }

  // Plausible / 自定义 analytics 钩子(未来扩展)
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (typeof w.plausible === 'function') {
      try {
        w.plausible(event, { props: scrub(props) });
      } catch {
        /* noop */
      }
    }
  }
}

/** 钱包地址这种敏感字段做短截,不把完整地址进统计 */
function scrub(props: TrackProps): TrackProps {
  const out: TrackProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string' && (k === 'wallet' || k === 'address') && v.length > 10) {
      out[k] = v.slice(0, 4) + '…' + v.slice(-4);
    } else {
      out[k] = v;
    }
  }
  return out;
}
