import { redirect } from 'next/navigation';

// T-UI-OVERHAUL Stage 5.4 · 跟单功能 R10 · 用户拍板"放最后" · 精简战略不展开
// nav 入口已无 · URL 直接访问 → redirect 到 / · CopyTradingView 文件保留供 R10 续做
export default function CopyTradingPage() {
  redirect('/');
}
