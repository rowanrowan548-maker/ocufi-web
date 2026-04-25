'use client';

/**
 * 手机端钱包 deeplink 引导
 *
 * Solana 生态通病:手机浏览器(Safari/Chrome)没有 `window.phantom` 注入,
 * wallet-adapter 扫不到钱包。用户必须**在钱包 app 自带浏览器里打开网站**才能连。
 *
 * 显示条件:
 *  - 当前是移动设备 UA
 *  - 不在 Phantom / Solflare 的 in-app browser 里(检测 window.phantom / window.solflare)
 *  - 钱包未连接
 *
 * 点击按钮 → 跳转 deeplink → 钱包 app 自动打开并在 in-app browser 加载网站
 */
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Smartphone, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent);
}

function isInWalletBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  // Phantom in-app 浏览器会注入 window.phantom;Solflare 会注入 window.solflare
  return !!(w.phantom?.solana || w.solflare);
}

export function MobileDeeplink() {
  const t = useTranslations();
  const { connected } = useWallet();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 仅在客户端判断
    setShow(isMobile() && !isInWalletBrowser() && !connected);
  }, [connected]);

  if (!show) return null;

  const currentUrl =
    typeof window !== 'undefined' ? window.location.href : 'https://www.ocufi.io';
  const encoded = encodeURIComponent(currentUrl);
  const phantomUrl = `https://phantom.app/ul/browse/${encoded}?ref=${encoded}`;
  const solflareUrl = `https://solflare.com/ul/v1/browse/${encoded}?ref=${encoded}`;

  return (
    <div className="w-full max-w-xl mx-auto rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm space-y-3">
      <div className="flex gap-2 items-start">
        <Smartphone className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
        <div>
          <div className="font-medium text-foreground">
            {t('mobile.title')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{t('mobile.hint')}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <a
          href={phantomUrl}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md
                     bg-[#4C44C6] text-white text-sm font-medium h-10 hover:opacity-90"
        >
          <ExternalLink className="h-4 w-4" />
          {t('mobile.openPhantom')}
        </a>
        <a
          href={solflareUrl}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md
                     bg-[#FC8F30] text-white text-sm font-medium h-10 hover:opacity-90"
        >
          <ExternalLink className="h-4 w-4" />
          {t('mobile.openSolflare')}
        </a>
      </div>
    </div>
  );
}
