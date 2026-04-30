import { Metadata } from 'next';
import { MarketsScreen } from '@/components/markets/markets-screen';

export const metadata: Metadata = {
  title: '行情 · Ocufi',
  description: '热门 / 新发 / 涨跌幅 / 已审 / 风险预警 · 6 维度看 Solana 市场',
};

export const dynamic = 'force-dynamic';

export default function MarketsPage() {
  return <MarketsScreen />;
}
