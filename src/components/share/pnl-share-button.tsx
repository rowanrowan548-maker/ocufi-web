'use client';

/**
 * 「分享我的战绩」按钮 · 持仓页用
 * 菜单 UI 走共享 ShareMenu 组件
 */
import { useEffect, useState } from 'react';
import { Trophy, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { buildPnlShareCard, type PnlShareCardData } from '@/lib/pnl-share-card';
import {
  inviteCodeFor, readCachedMyCode, cacheMyCode, buildInviteUrl,
} from '@/lib/invite';
import { toast } from 'sonner';
import { ShareMenu } from './share-menu';

interface Props {
  realizedUsd: number;
  unrealizedUsd: number;
  totalUsd: number;
  totalPct: number;
  winCount: number;
  closedCount: number;
  rangeLabel?: string;
  /** T-902:icon-only 紧凑模式,顶栏右上角用 */
  compact?: boolean;
}

export function PnlShareButton(props: Props) {
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
    if (!wallet.publicKey) return;
    setBusy(true);
    try {
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
      const url = URL.createObjectURL(blob);
      setGenerated({ blob, url, code });
    } catch (e) {
      console.warn('[pnl-share] failed', e);
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
        variant={props.compact ? 'ghost' : 'default'}
        className={props.compact ? 'h-8 w-8 p-0' : 'gap-1.5'}
        title={props.compact ? t('pnlButton') : undefined}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trophy className="h-3.5 w-3.5" />
        )}
        {!props.compact && t('pnlButton')}
      </Button>

      {generated && (
        <ShareMenu
          open={true}
          onClose={close}
          blob={generated.blob}
          imageUrl={generated.url}
          inviteUrl={buildInviteUrl(generated.code || '')}
          shareText={t('pnlShareText')}
          fileName={`ocufi-pnl-${Date.now()}.png`}
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
