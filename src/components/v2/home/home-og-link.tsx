'use client';

/**
 * V2 Home OG Card href 选 · client only
 * P3-FE-2 bug 2 · 用户有过 swap → href 跳真最近 sig · 没就跳 demo
 *
 * SSR 阶段 useLastTxSig 返 null · 渲染 demo · client hydrate 后 useEffect 拿到真 sig 切换
 * 不闪 OG 卡视觉(href 切换不影响内容)
 */
import { OgCard } from '@/components/v2/shared/og-card';
import { useLastTxSig } from '@/lib/last-tx-sig';
import { MOCK_TX_SIG } from '@/components/v2/shared/mock-sig';

type Variant = 'home-hero' | 'home-mobile';

type Props = {
  variant: Variant;
  topLabel: string;
  saveText: string;
  subText?: string;
  footLeft?: string;
  footRight?: string;
};

export function HomeOgLink(props: Props) {
  const lastSig = useLastTxSig();
  const sig = lastSig ?? MOCK_TX_SIG;
  return <OgCard {...props} href={`/v2/tx/${sig}`} />;
}
