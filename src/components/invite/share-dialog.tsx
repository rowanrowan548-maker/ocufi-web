'use client';

/**
 * T-941 #111 · 邀请分享 Dialog
 * 4 个选项:Twitter 预制推文 / Telegram 群分享 / 二维码(微信扫) / 复制链接
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Share2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { XIcon, TelegramIcon } from '@/components/brand/social-icons';

interface Props {
  /** 邀请 URL,如 `https://ocufi.io/?ref=ABC12345` */
  inviteUrl: string;
  /** 邀请码 · 用于 Twitter 模板填空 */
  code: string;
  /** 触发器:不传则显默认按钮 */
  children?: React.ReactNode;
}

export function ShareDialog({ inviteUrl, code, children }: Props) {
  const t = useTranslations('invite.share');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* */ }
  }

  // T-941 #115 · Twitter 预制推文
  function shareTwitter() {
    const text = t('twitterTemplate', { code });
    const tweetUrl =
      'https://twitter.com/intent/tweet' +
      `?text=${encodeURIComponent(text)}` +
      `&url=${encodeURIComponent(inviteUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  }

  // T-941 #111 · TG 分享
  function shareTelegram() {
    const text = t('telegramTemplate', { code });
    const tgUrl =
      'https://t.me/share/url' +
      `?url=${encodeURIComponent(inviteUrl)}` +
      `&text=${encodeURIComponent(text)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={(triggerProps) => (
        children ? (
          <span {...triggerProps}>{children}</span>
        ) : (
          <Button {...triggerProps} size="sm" className="flex-1">
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            {t('open')}
          </Button>
        )
      )} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 二维码 · 微信用户扫一扫 */}
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG
                value={inviteUrl}
                size={148}
                level="M"
                marginSize={0}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t('qrHint')}
            </div>
          </div>

          {/* URL 显示 + 复制 */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/40">
            <div className="flex-1 min-w-0 font-mono text-[11px] text-muted-foreground truncate">
              {inviteUrl}
            </div>
            <button
              type="button"
              onClick={copy}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              aria-label={t('copyUrl')}
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* 3 个分享按钮 */}
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={shareTwitter} variant="outline" size="sm" className="h-12 flex flex-col gap-0.5 px-1">
              <XIcon className="h-4 w-4" />
              <span className="text-[10px]">Twitter</span>
            </Button>
            <Button onClick={shareTelegram} variant="outline" size="sm" className="h-12 flex flex-col gap-0.5 px-1">
              <TelegramIcon className="h-4 w-4" />
              <span className="text-[10px]">Telegram</span>
            </Button>
            <Button onClick={copy} variant="outline" size="sm" className="h-12 flex flex-col gap-0.5 px-1">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              <span className="text-[10px]">{copied ? t('copied') : t('copyUrl')}</span>
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground/70 text-center pt-1">
            {t('wechatHint')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
