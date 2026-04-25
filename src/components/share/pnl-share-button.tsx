'use client';

/**
 * 「分享我的战绩」按钮 · 持仓页用
 * 生成 PnL 总盈亏卡 + 多端分享菜单(逻辑跟 ShareTradeButton 同款)
 */
import { useEffect, useRef, useState } from 'react';
import { Trophy, Loader2, Send, Copy, Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { buildPnlShareCard, type PnlShareCardData } from '@/lib/pnl-share-card';
import {
  inviteCodeFor, readCachedMyCode, cacheMyCode, buildInviteUrl,
} from '@/lib/invite';
import { toast } from 'sonner';

interface Props {
  realizedUsd: number;
  unrealizedUsd: number;
  totalUsd: number;
  totalPct: number;
  winCount: number;
  closedCount: number;
  rangeLabel?: string;
}

export function PnlShareButton(props: Props) {
  const t = useTranslations('share');
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [generated, setGenerated] = useState<{ blob: Blob; url: string; code: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    if (generated?.url) URL.revokeObjectURL(generated.url);
    setGenerated(null);
  }

  async function generate(): Promise<{ blob: Blob; code: string } | null> {
    if (!wallet.publicKey) return null;
    const addr = wallet.publicKey.toBase58();
    let code = readCachedMyCode(addr) || '';
    if (!code) {
      code = await inviteCodeFor(addr);
      if (code) cacheMyCode(addr, code);
    }

    const data: PnlShareCardData = {
      walletAddress: addr,
      inviteCode: code || 'ocufi',
      realizedUsd: props.realizedUsd,
      unrealizedUsd: props.unrealizedUsd,
      totalUsd: props.totalUsd,
      totalPct: props.totalPct,
      winCount: props.winCount,
      closedCount: props.closedCount,
      rangeLabel: props.rangeLabel ?? 'All-time',
    };
    const blob = await buildPnlShareCard(data);
    return { blob, code };
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await generate();
      if (!result) return;
      const { blob, code } = result;
      const file = new File([blob], `ocufi-pnl-${Date.now()}.png`, { type: 'image/png' });
      const inviteUrl = buildInviteUrl(code || '');
      const text = t('pnlShareText');

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
          console.warn('[pnl-share] webShare failed', e);
        }
      }

      const url = URL.createObjectURL(blob);
      setGenerated({ blob, url, code });
      setMenuOpen(true);
    } catch (e: unknown) {
      console.warn('[pnl-share] failed', e);
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  function openTwitter() {
    if (!generated) return;
    const inviteUrl = buildInviteUrl(generated.code);
    const text = t('pnlShareText');
    triggerDownload(generated.url, 'pnl');
    const tweetUrl =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + '\n\n')}&url=${encodeURIComponent(inviteUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    toast.info(t('downloadHint'), { duration: 5000 });
    closeMenu();
  }

  function openTelegram() {
    if (!generated) return;
    const inviteUrl = buildInviteUrl(generated.code);
    const text = t('pnlShareText');
    triggerDownload(generated.url, 'pnl');
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
    toast.info(t('downloadHint'), { duration: 5000 });
    closeMenu();
  }

  async function copyImage() {
    if (!generated) return;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': generated.blob })]);
        toast.success(t('copiedImage'));
        closeMenu();
        return;
      }
      throw new Error('clipboard write not supported');
    } catch (e) {
      console.warn('[pnl-share] clipboard failed', e);
      toast.error(t('copyFailed'));
    }
  }

  function downloadOnly() {
    if (!generated) return;
    triggerDownload(generated.url, 'pnl');
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
        className="gap-1.5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
        {t('pnlButton')}
      </Button>

      {menuOpen && generated && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-border/60 bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
            <span className="text-xs font-medium">{t('chooseChannel')}</span>
            <button type="button" onClick={closeMenu} className="p-0.5 hover:bg-muted/40 rounded">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="p-2 border-b border-border/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={generated.url} alt="preview" className="w-full rounded border border-border/40" />
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
  icon?: typeof Trophy;
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

function triggerDownload(blobUrl: string, prefix: string) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `ocufi-${prefix}-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
