'use client';

/**
 * 「晒一单」按钮 · 生成卡片图 + 多端分享
 *
 * 移动端 / 支持 Web Share API 的浏览器:点一下弹原生分享菜单(可选 TG / Twitter / 微信 / 微博等)
 * 桌面 fallback:弹自定义小菜单(Twitter / Telegram / 复制图片到剪贴板 / 下载)
 */
import { useEffect, useRef, useState } from 'react';
import { Share2, Loader2, Send, Copy, Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { buildTradeCard, type ShareCardData } from '@/lib/share-card';
import {
  inviteCodeFor, readCachedMyCode, cacheMyCode, buildInviteUrl,
} from '@/lib/invite';
import { fetchTokenInfo } from '@/lib/portfolio';
import { toast } from 'sonner';

interface Props {
  mint: string;
  kind: 'buy' | 'sell';
  amount: number;
  solAmount: number;
  pnlPct?: number;
}

export function ShareTradeButton(props: Props) {
  const t = useTranslations('share');
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  // 桌面 fallback 菜单状态
  const [menuOpen, setMenuOpen] = useState(false);
  const [generated, setGenerated] = useState<{ blob: Blob; url: string; code: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点外面关菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    if (generated?.url) {
      URL.revokeObjectURL(generated.url);
    }
    setGenerated(null);
  }

  async function generate(): Promise<{ blob: Blob; code: string } | null> {
    let code = '';
    if (wallet.publicKey) {
      const addr = wallet.publicKey.toBase58();
      const cached = readCachedMyCode(addr);
      if (cached) code = cached;
      else {
        code = await inviteCodeFor(addr);
        if (code) cacheMyCode(addr, code);
      }
    }

    const info = await fetchTokenInfo(props.mint);
    const symbol = info?.symbol || props.mint.slice(0, 6);
    const logoUrl = info?.logoUri;
    const usdAmount = info && info.priceUsd > 0 ? info.priceUsd * props.amount : undefined;

    const data: ShareCardData = {
      kind: props.kind,
      symbol,
      amount: props.amount,
      solAmount: props.solAmount,
      usdAmount,
      logoUrl,
      pnlPct: props.pnlPct,
      inviteCode: code || 'ocufi',
      priceUsd: info?.priceUsd,
      priceChange24h: info?.priceChange24h,
      priceChange6h: info?.priceChange6h,
      priceChange1h: info?.priceChange1h,
      priceChange5m: info?.priceChange5m,
    };
    const blob = await buildTradeCard(data);
    return { blob, code };
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await generate();
      if (!result) return;
      const { blob, code } = result;
      const file = new File([blob], `ocufi-trade-${Date.now()}.png`, { type: 'image/png' });
      const inviteUrl = buildInviteUrl(code || '');
      const text = t('shareText');

      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (
        typeof nav.share === 'function' &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [file] })
      ) {
        try {
          await nav.share({ files: [file], text, url: inviteUrl });
          toast.success(t('shared'));
          return;
        } catch (e: unknown) {
          if (e instanceof Error && (e.name === 'AbortError' || /abort|cancel/i.test(e.message))) return;
          // share API 失败 → fallback 到菜单
          console.warn('[share] webShare failed, fallback', e);
        }
      }

      // 桌面 fallback:弹自定义菜单
      const url = URL.createObjectURL(blob);
      setGenerated({ blob, url, code });
      setMenuOpen(true);
    } catch (e: unknown) {
      console.warn('[share] failed', e);
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  // ── 菜单内的具体动作 ──

  function openTwitter() {
    if (!generated) return;
    const inviteUrl = buildInviteUrl(generated.code);
    const text = t('shareText');
    // 自动下载图(让用户拖到推上)
    triggerDownload(generated.url);
    const tweetUrl =
      `https://twitter.com/intent/tweet` +
      `?text=${encodeURIComponent(text + '\n\n')}` +
      `&url=${encodeURIComponent(inviteUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    toast.info(t('downloadHint'), { duration: 5000 });
    closeMenu();
  }

  function openTelegram() {
    if (!generated) return;
    const inviteUrl = buildInviteUrl(generated.code);
    const text = t('shareText');
    triggerDownload(generated.url);
    const tgUrl =
      `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}` +
      `&text=${encodeURIComponent(text)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
    toast.info(t('downloadHint'), { duration: 5000 });
    closeMenu();
  }

  async function copyImage() {
    if (!generated) return;
    try {
      // 优先 ClipboardItem(Chrome / Safari / Edge 现代版本)
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': generated.blob }),
        ]);
        toast.success(t('copiedImage'));
        closeMenu();
        return;
      }
      throw new Error('clipboard write not supported');
    } catch (e) {
      console.warn('[share] clipboard failed', e);
      toast.error(t('copyFailed'));
    }
  }

  function downloadOnly() {
    if (!generated) return;
    triggerDownload(generated.url);
    toast.success(t('downloaded'));
    closeMenu();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        type="button"
        onClick={handleClick}
        disabled={busy}
        size="sm"
        variant="outline"
        className="gap-1.5"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Share2 className="h-3.5 w-3.5" />
        )}
        {t('button')}
      </Button>

      {menuOpen && generated && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-border/60 bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
            <span className="text-xs font-medium">{t('chooseChannel')}</span>
            <button
              type="button"
              onClick={closeMenu}
              className="p-0.5 hover:bg-muted/40 rounded"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          {/* 预览缩略图 */}
          <div className="p-2 border-b border-border/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={generated.url}
              alt="preview"
              className="w-full rounded border border-border/40"
            />
          </div>
          <div className="py-1">
            <MenuItem emoji="𝕏" label={t('via.twitter')} onClick={openTwitter} />
            <MenuItem icon={Send} label={t('via.telegram')} onClick={openTelegram} />
            <MenuItem icon={Copy} label={t('via.copyImage')} onClick={copyImage} />
            <MenuItem icon={Download} label={t('via.download')} onClick={downloadOnly} />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon, emoji, label, onClick,
}: {
  icon?: typeof Share2;
  emoji?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors text-left text-sm"
    >
      {Icon ? (
        <Icon className="h-4 w-4 text-muted-foreground" />
      ) : (
        <span className="w-4 inline-flex items-center justify-center text-muted-foreground">{emoji}</span>
      )}
      <span>{label}</span>
    </button>
  );
}

function triggerDownload(blobUrl: string) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `ocufi-trade-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
