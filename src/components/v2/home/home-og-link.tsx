'use client';

/**
 * V2 Home OG Card · client only
 *
 * P3-FE-2 / P3-FE-3 · 用户有过 swap → click 跳真最近 sig
 * P3-FE-11 熵减 #7 · 没连钱包 / 0 swap → 砍假数字 + 砍 MOCK_TX_SIG 兜底
 *   → 渲染通用 placeholder 文案("每笔成交自动生成 · 永久 URL") · 不 click
 *   → 用户不再被 fake 0.0045 SOL on $BONK 误导(以为是自己数据)
 *
 * SSR 阶段 lastSig=null · 渲染 placeholder · client hydrate 后 useEffect 拿到真 sig 切真内容
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import { OgCard } from '@/components/v2/shared/og-card';
import { useLastTxSig } from '@/lib/last-tx-sig';

type Variant = 'home-hero' | 'home-mobile';

type Props = {
  variant: Variant;
  /** 真 sig 时显的 4 字段 · placeholder 模式忽略 · 走 i18n */
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

  if (lastSig) {
    // 真 sig · click 跳真报告 · 上层传的真用户数据照旧渲染
    return <OgCard {...props} href={`/v2/tx/${lastSig}`} />;
  }
  // 没 sig · 用通用 placeholder 文案 · 砍 click(防跳到 mock /v2/tx/<MOCK_TX_SIG>)
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
