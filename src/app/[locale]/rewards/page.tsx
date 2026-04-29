import { Metadata } from 'next';
import { RewardsScreen } from '@/components/rewards/rewards-screen';

export const metadata: Metadata = {
  title: '奖励中心 · Ocufi',
  description: '空账户回收 SOL · MEV 返还累计 · 邀请返佣 · gmgn 没这一套',
};

export const dynamic = 'force-dynamic';

export default function RewardsPage() {
  return <RewardsScreen />;
}
