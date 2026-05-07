/**
 * 轻量埋点
 *
 * 三件事:
 * 1. 所有事件打到 console(本地开发/排查用)
 * 2. 如果浏览器里有 window.plausible(Plausible 脚本)— 透传一份
 * 3. P5-FE-15 改 3 · fire-and-forget POST 后端 /track · 写 events 表 · funnel 真有数
 *
 * 不做:GA、不收集任何 PII(钱包地址会做短截 · scrub 复用)
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

    // P5-FE-15 改 3 · 真打后端 events 表 · 不阻塞调用方 · 失败静默
    // 后端 /track P5-BE-2 改 3 已 ship · 接 {event, props} 写 AnalyticsEvent + PageView
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      try {
        fetch(`${apiUrl.replace(/\/$/, '')}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, props: scrub(props) }),
          keepalive: true, // 页面关闭时仍发送
        }).catch(() => {});
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
