'use client';

/**
 * 分享菜单弹窗 · trade 卡 / PnL 卡共用
 *
 * 设计:居中大弹窗,顶部大图预览(用户看清要分享什么),底部操作按钮 grid
 *
 * 用 createPortal 渲染到 body 直下,逃 SiteHeader 的 stacking context
 * z-index = 60 跟 mobile-nav 同级,避免被其他元素遮
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Copy, Download, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface Labels {
  title: string;
  twitter: string;
  telegram: string;
  copyImage: string;
  download: string;
  moreApps: string;
  copiedImage: string;
  copyFailed: string;
  downloaded: string;
  downloadHint: string;
  failed: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  blob: Blob;
  imageUrl: string;
  inviteUrl: string;
  shareText: string;
  fileName: string;
  labels: Labels;
}

export function ShareMenu({
  open, onClose, blob, imageUrl, inviteUrl, shareText, fileName, labels,
}: Props) {
  // ESC 关 + 锁 body 滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = orig;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  function triggerDownload() {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function openTwitter() {
    triggerDownload();
    const tweetUrl =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + '\n\n')}` +
      `&url=${encodeURIComponent(inviteUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    toast.info(labels.downloadHint, { duration: 5000 });
    onClose();
  }

  function openTelegram() {
    triggerDownload();
    const tgUrl =
      `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}` +
      `&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
    toast.info(labels.downloadHint, { duration: 5000 });
    onClose();
  }

  async function copyImage() {
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success(labels.copiedImage);
        onClose();
        return;
      }
      throw new Error('clipboard write not supported');
    } catch {
      toast.error(labels.copyFailed);
    }
  }

  function downloadOnly() {
    triggerDownload();
    toast.success(labels.downloaded);
    onClose();
  }

  function canSystemShare(): boolean {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
    try {
      return nav.canShare({ files: [new File([blob], 'ocufi.png', { type: 'image/png' })] });
    } catch {
      return false;
    }
  }

  async function shareViaSystem() {
    try {
      await navigator.share({
        files: [new File([blob], fileName, { type: 'image/png' })],
        text: shareText,
        url: inviteUrl,
      });
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error && (e.name === 'AbortError' || /abort|cancel/i.test(e.message))) return;
      toast.error(labels.failed);
    }
  }

  const hasSystemShare = canSystemShare();

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden my-auto"
        style={{ backgroundColor: '#13151A', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-sm font-semibold">{labels.title}</span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center hover:bg-white/5 rounded transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 大图预览 · 16:9 比例,完整呈现卡片 */}
        <div className="p-4 sm:p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="preview"
            className="w-full rounded-lg block"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>

        {/* 操作按钮 · 大格子,移动端 2 列,桌面端最多 5 列 */}
        <div
          className="px-4 sm:px-5 pb-5 pt-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className={`grid gap-2 mt-3 ${hasSystemShare ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
            <ActionBtn emoji="𝕏" label={labels.twitter} onClick={openTwitter} />
            <ActionBtn icon={Send} label={labels.telegram} onClick={openTelegram} />
            <ActionBtn icon={Copy} label={labels.copyImage} onClick={copyImage} />
            <ActionBtn icon={Download} label={labels.download} onClick={downloadOnly} />
            {hasSystemShare && (
              <ActionBtn icon={Smartphone} label={labels.moreApps} onClick={shareViaSystem} />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ActionBtn({
  icon: Icon, emoji, label, onClick,
}: {
  icon?: typeof X;
  emoji?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-md transition-colors hover:bg-white/5 min-h-[72px]"
      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {Icon ? (
        <Icon className="h-5 w-5 text-muted-foreground" />
      ) : (
        <span className="text-xl leading-none h-5 inline-flex items-center text-foreground">
          {emoji}
        </span>
      )}
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </button>
  );
}
