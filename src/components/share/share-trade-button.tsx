'use client';

/**
 * 「晒一单」按钮 · 生成交易卡片图 + 分享/下载
 *
 * 移动端:Web Share API → 直接弹原生分享菜单(发 TG / Twitter / 朋友圈)
 * 桌面:下载 PNG 到本地 + 打开 Twitter compose 窗口让用户手动上传
 *
 * 卡片右下角带邀请码水印,引流闭环
 */
import { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
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
  /** 交易代币 mint,组件会自己 fetch symbol + logo */
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

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      // 1. 拿到自己的邀请码
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

      // 2. 拉 token info(symbol + logo + 价格 → USD)· 缓存命中 30s 不重打外部
      const info = await fetchTokenInfo(props.mint);
      const symbol = info?.symbol || props.mint.slice(0, 6);
      const logoUrl = info?.logoUri;
      // 用 token 美元价 × 数量算 usdAmount(更准),退化用 solAmount × 假定 $80 略
      let usdAmount: number | undefined;
      if (info && info.priceUsd > 0) usdAmount = info.priceUsd * props.amount;

      // 3. Canvas 生图
      const data: ShareCardData = {
        kind: props.kind,
        symbol,
        amount: props.amount,
        solAmount: props.solAmount,
        usdAmount,
        logoUrl,
        pnlPct: props.pnlPct,
        inviteCode: code || 'ocufi',
      };
      const blob = await buildTradeCard(data);
      const file = new File([blob], `ocufi-trade-${Date.now()}.png`, {
        type: 'image/png',
      });

      const inviteUrl = buildInviteUrl(code || '');
      const text = t('shareText');

      // 3. 优先 Web Share API(移动端原生分享菜单)
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (
        typeof nav.share === 'function' &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [file] })
      ) {
        await nav.share({
          files: [file],
          text,
          url: inviteUrl,
        });
        toast.success(t('shared'));
        return;
      }

      // 4. 桌面 fallback:下载 + 打开 Twitter compose
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // 给浏览器一点时间触发下载再 revoke
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      const tweetUrl =
        `https://twitter.com/intent/tweet` +
        `?text=${encodeURIComponent(text + '\n\n')}` +
        `&url=${encodeURIComponent(inviteUrl)}`;
      window.open(tweetUrl, '_blank', 'noopener,noreferrer');
      toast.info(t('downloadHint'), { duration: 6000 });
    } catch (e: unknown) {
      // 用户取消分享不算错
      if (
        e instanceof Error &&
        (e.name === 'AbortError' || /share canceled|abort/i.test(e.message))
      ) {
        return;
      }
      console.warn('[share] failed', e);
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={share}
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
  );
}
