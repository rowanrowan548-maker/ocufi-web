import { redirect } from 'next/navigation';

// T-UI-OVERHAUL Stage 5.4 · 砍 nav 不砍代码 · /markets 不再有 UI 入口
// URL 直接访问 → redirect 到首页 · 旧 MarketsScreen 组件保留以便回滚
export default function MarketsPage() {
  redirect('/');
}
