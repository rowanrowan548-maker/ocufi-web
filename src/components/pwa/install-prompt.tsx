'use client';

/**
 * PWA 安装到主屏 · 浮动卡片
 *
 * Android Chrome:监听 beforeinstallprompt → 用户点「添加到主屏」时调 prompt()
 * iOS Safari:无 install API,展示「分享 → 添加到主屏」引导
 *
 * 30 天内被拒绝过就不再显示
 *
 * P2-MOBILE-OVERHAUL #1:V2 阶段(/v2/*)完全不显 · banner 在 mobile 12/12 截图盖内容
 * 等 Phase 4 软发布前 V2 mv 顶层后再放开 · V1 路径仍会显
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'ocufi.pwa.dismissedAt';
const DISMISS_DAYS = 30;

export function InstallPrompt() {
  const t = useTranslations('pwa.install');
  const pathname = usePathname();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  // V2 路径完全早退 · banner 12/12 截图盖内容 · 等 Phase 4 mv 顶层后再放开
  const isV2 = pathname?.includes('/v2/') || pathname?.endsWith('/v2');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isV2) return; // V2 不挂监听器

    // 已安装的 standalone 模式不显示
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // 30 天内拒绝过就别再骚扰
    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const ago = Date.now() - Number(dismissed);
        if (ago < DISMISS_DAYS * 86400_000) return;
      }
    } catch { /* */ }

    // 监听 Chrome / Edge / 安卓的 install event
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari 没有事件,自检 UA + 不在 standalone 时显示引导
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
    if (isIos) {
      setShowIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isV2]);

  if (isV2) return null;

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* */ }
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') {
      setHidden(true);
    } else {
      dismiss();
    }
  }

  if (hidden) return null;

  return (
    <div className="fixed bottom-20 right-4 z-30 max-w-xs">
      <div className="rounded-lg border border-border/60 bg-card shadow-xl p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
            <Download className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{t('title')}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {showIosHint ? t('iosBody') : t('body')}
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="dismiss"
            className="p-1 hover:bg-muted/40 rounded transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        {!showIosHint && event && (
          <button
            type="button"
            onClick={install}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-background h-9 text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Download className="h-3.5 w-3.5" />
            {t('installButton')}
          </button>
        )}
        {showIosHint && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded p-2">
            <Share className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{t('iosSteps')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
