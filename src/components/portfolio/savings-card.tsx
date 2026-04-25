'use client';

/**
 * 「已节省手续费」 · 病毒传播触发点 · 持仓页顶部显眼位置
 *
 * 算法:对比 gmgn 1% / Ocufi 0.1%(买入) — 用户每 SOL 体量省 0.009 SOL
 * USD 折算用当前 SOL 价(从 portfolio sol.valueUsd / sol.amount 推)
 *
 * 底部「分享给朋友」按钮 → 跳 Twitter compose,文案 + 邀请链接
 */
import { Sparkles, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { inviteCodeFor, readCachedMyCode, cacheMyCode, buildInviteUrl } from '@/lib/invite';
import { toast } from 'sonner';

interface Props {
  volumeSol: number;
  txCount: number;
  solUsdPrice: number;
}

const COMPETITOR_RATE = 0.01;   // gmgn / bullx 取整 1%
const OCUFI_RATE = 0.001;        // 0.1%
const SAVED_PER_SOL = COMPETITOR_RATE - OCUFI_RATE;  // 0.009

export function SavingsCard({ volumeSol, txCount, solUsdPrice }: Props) {
  const t = useTranslations('portfolio.savings');
  const wallet = useWallet();
  const [myCode, setMyCode] = useState<string>('');

  // 算我的邀请码(SHA-256 异步)
  useEffect(() => {
    if (!wallet.publicKey) return;
    const addr = wallet.publicKey.toBase58();
    const cached = readCachedMyCode(addr);
    if (cached) { setMyCode(cached); return; }
    inviteCodeFor(addr).then((c) => {
      if (c) {
        setMyCode(c);
        cacheMyCode(addr, c);
      }
    });
  }, [wallet.publicKey]);

  const savedSol = volumeSol * SAVED_PER_SOL;
  const savedUsd = savedSol * (solUsdPrice || 0);
  const competitorWouldChargeUsd = volumeSol * COMPETITOR_RATE * (solUsdPrice || 0);

  function shareTwitter() {
    const code = myCode || '';
    const url = buildInviteUrl(code);
    const text = t('shareText', {
      saved: savedUsd.toFixed(2),
      count: txCount,
    });
    const tweetUrl =
      `https://twitter.com/intent/tweet` +
      `?text=${encodeURIComponent(text + '\n\n')}` +
      `&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  }

  async function copyLink() {
    const code = myCode || '';
    const url = buildInviteUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <Card className="relative overflow-hidden border-primary/20">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 100% 0%, oklch(0.88 0.25 155 / 12%), transparent 70%)',
        }}
      />
      <div className="relative p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary/80">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-medium">{t('label')}</span>
        </div>

        <div>
          <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight">
            ${savedUsd.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t('subtitle', { count: txCount, sol: savedSol.toFixed(4) })}
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground/70 border-t border-border/40 pt-3">
          {t('comparison', {
            ocufi: (volumeSol * OCUFI_RATE * solUsdPrice).toFixed(2),
            competitor: competitorWouldChargeUsd.toFixed(2),
          })}
        </div>

        <div className="flex gap-2">
          <Button onClick={shareTwitter} size="sm" className="flex-1">
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            {t('shareTwitter')}
          </Button>
          <Button onClick={copyLink} size="sm" variant="outline" className="flex-1">
            {t('copyLink')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
