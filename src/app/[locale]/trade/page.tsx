import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { TradeScreen } from '@/components/trade/trade-screen';

// T-SEARCH-CLICK-FIX5 · 探针式兜底 · 强制 dynamic SSR (不走静态预渲染)
// 用户在 prod 报 #418 hydration mismatch · 桌面 only · 桌面子树 re-create 时
// 第一次 click handler 没绑成 → 4 次 v4 log 都触发但 URL 不动
// 真因 #1(已修):src/lib/phantom-connect.ts PHANTOM_REDIRECT_URL 用 typeof window
//   差 SSR/CSR · 配置 PhantomProvider config 后某些路径上 hydration desync
// 真因 #2(防御):静态预渲染的 HTML 跟 dynamic env(prelaunch cookie / etc.)在
//   每次访问时可能产生差异 · force-dynamic 让 server 每次重渲染 · 跟 CSR 时态一致
// cold start 慢 ~200-500ms 接受 · trade 页是动态数据 · 静态预渲染本来收益就有限
export const dynamic = 'force-dynamic';

export default async function TradePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      {/* T-SEARCH-FIX · TradeScreen 用 useSearchParams 反应式跟踪 ?mint=,
          需 Suspense 包裹满足 Next 16 SSR/CSR bailout 要求 */}
      <Suspense fallback={null}>
        <TradeScreen />
      </Suspense>
    </main>
  );
}
