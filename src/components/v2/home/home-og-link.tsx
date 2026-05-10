'use client';

/**
 * V2 Home OG Card · client only
 *
 * P3-FE-2 / P3-FE-3 · 用户有过 swap → click 跳真最近 sig
 * P3-FE-11 熵减 #7 · 没连钱包 / 0 swap → 渲染通用 placeholder · 砍 mock 兜底
 * P3-FE-12 熵减真治根 · 有 lastSig → useEffect fetch 真 detail · OG 卡显真数字
 *   不再让 caller 传 mock "SAVED 0.0045 SOL on $BONK" 当 fallback
 *
 * 三态:
 *   1. lastSig=null              → placeholder("每笔成交自动生成 · 永久 URL")· 不 click
 *   2. lastSig 有 + detail loading → placeholder · click 跳 /tx/<sig>(用户已知有 swap · loading 短)
 *   3. lastSig 有 + detail ok    → 真数字 + 真 token symbol · click 跳真报告
 *
 * SSR 阶段 lastSig=null · 渲染 placeholder · client hydrate 后 useEffect 链路启动
 */
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import { OgCard } from '@/components/v2/shared/og-card';
import { useLastTxSig } from '@/lib/last-tx-sig';
import { getTransparencyReport, mapReportToView, type TxViewData } from '@/lib/transparency';
import { useTokenMeta } from '@/lib/token-display';

type Variant = 'home-hero' | 'home-mobile';

type Props = {
  variant: Variant;
  /** caller 仍传 · 不再使用(防 placeholder 接口不变 · 减少 home-hero 改动) · placeholder 走 i18n */
  topLabel: string;
  saveText: string;
  subText?: string;
  footLeft?: string;
  footRight?: string;
};

export function HomeOgLink(props: Props) {
  const { publicKey } = useWallet();
  const lastSig = useLastTxSig(publicKey?.toBase58() ?? null);
  const tPlaceholder = useTranslations('v2.home.ogCard.placeholder');
  const tTx = useTranslations('v2.tx');
  const [detail, setDetail] = useState<TxViewData | null>(null);

  // P3-FE-12 · lastSig 变化 → fetch 真 detail · 失败保持 null · 走 placeholder
  useEffect(() => {
    if (!lastSig) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    getTransparencyReport(lastSig)
      .then((r) => {
        if (cancelled) return;
        setDetail(r ? mapReportToView(r) : null);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [lastSig]);

  if (lastSig && detail) {
    return <RealOgCard {...props} sig={lastSig} detail={detail} tTx={tTx} />;
  }
  if (lastSig) {
    // 有 sig · 没 detail · click 跳报告(SSR 拿/或 retry)· 卡内容仍 placeholder
    return (
      <OgCard
        variant={props.variant}
        href={`/tx/${lastSig}`}
        topLabel={tPlaceholder('label')}
        saveText={tPlaceholder('line')}
        subText={tPlaceholder('sub')}
        footLeft={tPlaceholder('footLeft')}
        footRight={tPlaceholder('footRight')}
      />
    );
  }
  // 没 sig · 完全 placeholder · 不 click
  return (
    <OgCard
      variant={props.variant}
      topLabel={tPlaceholder('label')}
      saveText={tPlaceholder('line')}
      subText={tPlaceholder('sub')}
      footLeft={tPlaceholder('footLeft')}
      footRight={tPlaceholder('footRight')}
    />
  );
}

function RealOgCard({
  variant,
  sig,
  detail,
  tTx,
}: {
  variant: Variant;
  sig: string;
  detail: TxViewData;
  tTx: ReturnType<typeof useTranslations>;
}) {
  // 主 token = buy 看 out / sell 看 in
  const focus = detail.side === 'buy' ? detail.tokenOut : detail.tokenIn;
  const meta = useTokenMeta(focus.mint, focus.symbol);
  const dp = detail.solDp;
  const savedStr = detail.savedSol > 0
    ? `${tTx('savedPrefix').toUpperCase()} ${detail.savedSol.toFixed(dp)} ${tTx('savedSuffix')}`
    : tTx('noFeeBaseline');
  const subParts = [
    `vs industry standard`,
    `${detail.feePct.toFixed(2)}% fee`,
    detail.mevProtected ? 'MEV protected' : 'standard',
  ];
  return (
    <OgCard
      variant={variant}
      href={`/tx/${sig}`}
      topLabel={`OCUFI · TX REPORT`}
      saveText={savedStr}
      subText={subParts.join(' · ')}
      footLeft={detail.sigShort}
      footRight={detail.savedUsd != null ? `≈ $${detail.savedUsd.toFixed(2)} saved` : undefined}
      tokenLogo={meta.logoURI ?? undefined}
      tokenSymbol={meta.symbol}
    />
  );
}
