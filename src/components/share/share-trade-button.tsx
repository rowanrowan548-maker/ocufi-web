'use client';

/**
 * 「晒一单」按钮 · 触发交易卡生成 + 分享菜单
 * 菜单 UI 走共享 ShareMenu 组件
 */
import { useEffect, useState } from 'react';
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
import { ShareMenu } from './share-menu';

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
  const [generated, setGenerated] = useState<{ blob: Blob; url: string; code: string } | null>(null);

  useEffect(() => () => {
    if (generated?.url) URL.revokeObjectURL(generated.url);
  }, [generated]);

  function close() {
    if (generated?.url) URL.revokeObjectURL(generated.url);
    setGenerated(null);
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      let code = '';
      if (wallet.publicKey) {
        const addr = wallet.publicKey.toBase58();
        code = readCachedMyCode(addr) || '';
        if (!code) {
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
      const url = URL.createObjectURL(blob);
      setGenerated({ blob, url, code });
    } catch (e) {
      console.warn('[share] failed', e);
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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

      {generated && (
        <ShareMenu
          open={true}
          onClose={close}
          blob={generated.blob}
          imageUrl={generated.url}
          inviteUrl={buildInviteUrl(generated.code || '')}
          shareText={t('shareText')}
          fileName={`ocufi-trade-${Date.now()}.png`}
          labels={{
            title: t('chooseChannel'),
            twitter: t('via.twitter'),
            telegram: t('via.telegram'),
            copyImage: t('via.copyImage'),
            download: t('via.download'),
            moreApps: t('via.moreApps'),
            copiedImage: t('copiedImage'),
            copyFailed: t('copyFailed'),
            downloaded: t('downloaded'),
            downloadHint: t('downloadHint'),
            failed: t('failed'),
          }}
        />
      )}
    </>
  );
}
