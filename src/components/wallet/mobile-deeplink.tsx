'use client';

/**
 * 手机端钱包 deeplink 引导(弹窗版)
 *
 * Solana 生态通病:手机浏览器(Safari/Chrome)没有 `window.phantom` 注入,
 * wallet-adapter 扫不到钱包。用户必须在钱包 app 自带浏览器里打开网站才能连。
 *
 * 显示条件:
 *  - 移动设备 UA
 *  - 不在 Phantom / Solflare 的 in-app browser 里
 *  - 钱包未连接
 *  - 24h 内没被关闭过
 *
 * 改成弹窗(原 inline banner 占地方且影响美观)。关闭后 24h 不再弹。
 */
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Smartphone, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'ocufi.mobile-hint.dismissedAt';
const DISMISS_HOURS = 24;

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent);
}

function isInWalletBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return !!(w.phantom?.solana || w.solflare);
}

function recentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  // 调试旁路:?showWalletHint=1 强制弹一次,方便测试
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('showWalletHint') === '1') {
      window.localStorage.removeItem(DISMISS_KEY);
      return false;
    }
  } catch { /* */ }
  try {
    const v = window.localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ago = Date.now() - Number(v);
    return ago < DISMISS_HOURS * 3600_000;
  } catch {
    return false;
  }
}

export function MobileDeeplink() {
  const t = useTranslations();
  const { connected } = useWallet();
  const [open, setOpen] = useState(false);
  const [phantomUrl, setPhantomUrl] = useState('');
  const [solflareUrl, setSolflareUrl] = useState('');

  useEffect(() => {
    // 仅在客户端检测,且只在条件满足时弹一次
    if (!isMobile()) return;
    if (isInWalletBrowser()) return;
    if (connected) return;
    if (recentlyDismissed()) return;

    // 延迟一点再弹,避免和页面初次渲染抢主线程
    const t = setTimeout(() => {
      const url = window.location.href;
      const enc = encodeURIComponent(url);
      setPhantomUrl(`https://phantom.app/ul/browse/${enc}?ref=${enc}`);
      setSolflareUrl(`https://solflare.com/ul/v1/browse/${enc}?ref=${enc}`);
      setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, [connected]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* */
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Smartphone className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="leading-snug">{t('mobile.title')}</span>
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {t('mobile.hint')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2">
          <a
            href={phantomUrl}
            className="inline-flex items-center justify-center gap-2 rounded-md
                       bg-[#4C44C6] text-white text-sm font-medium h-11 hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" />
            {t('mobile.openPhantom')}
          </a>
          <a
            href={solflareUrl}
            className="inline-flex items-center justify-center gap-2 rounded-md
                       bg-[#FC8F30] text-white text-sm font-medium h-11 hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" />
            {t('mobile.openSolflare')}
          </a>
          <Button
            variant="ghost"
            onClick={dismiss}
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
          >
            {t('mobile.later')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
