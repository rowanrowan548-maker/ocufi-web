'use client';

/**
 * T-928 #18 · 顶部右上角服务状态绿点
 *
 * - 常驻小圆点(8px),颜色:🟢 绿(全部正常) / 🟡 黄(降级) / 🔴 红(挂掉)
 * - 60s 轮询 /health
 * - hover/click 弹 popover:状态文本 + 跳 /status 详情
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { pingHealth, isApiConfigured } from '@/lib/api-client';

type Status = 'ok' | 'degraded' | 'down' | 'unknown';

const POLL_MS = 60_000;

export function StatusIndicator() {
  const t = useTranslations('status.indicator');
  const [status, setStatus] = useState<Status>('unknown');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isApiConfigured()) {
      setStatus('unknown');
      return;
    }
    let cancelled = false;
    async function tick() {
      try {
        const r = await pingHealth();
        if (cancelled) return;
        // 后端 /health 返 { status: "ok" | "degraded" | ... }
        const s = String(r.status ?? '').toLowerCase();
        if (s === 'ok' || s === 'healthy') setStatus('ok');
        else if (s === 'degraded' || s === 'warn') setStatus('degraded');
        else setStatus('down');
      } catch {
        if (!cancelled) setStatus('down');
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // 点外面关
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const info = statusInfo(status);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t(`label.${status}`)}
        title={t(`label.${status}`)}
        className="h-9 w-9 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <span
          className={`h-2 w-2 rounded-full ${info.dotClass} ${
            status === 'ok' ? 'animate-pulse' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 rounded-md border border-border bg-popover shadow-xl p-3 z-50 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${info.dotClass}`} />
            <span className={`text-sm font-medium ${info.textClass}`}>
              {t(`label.${status}`)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t(`desc.${status}`)}
          </div>
          <Link
            href="/status"
            onClick={() => setOpen(false)}
            className="block text-xs text-primary hover:underline"
          >
            {t('viewFull')} →
          </Link>
        </div>
      )}
    </div>
  );
}

function statusInfo(s: Status): { dotClass: string; textClass: string } {
  switch (s) {
    case 'ok':
      return { dotClass: 'bg-success', textClass: 'text-success' };
    case 'degraded':
      return { dotClass: 'bg-warning', textClass: 'text-warning' };
    case 'down':
      return { dotClass: 'bg-destructive', textClass: 'text-destructive' };
    case 'unknown':
    default:
      return { dotClass: 'bg-muted-foreground', textClass: 'text-muted-foreground' };
  }
}
