/**
 * T-FAQ-125 · 应用内 "?" deep link 跳到 /faq 对应条目
 *
 * 使用:`<FaqHelpIcon topic="slippage" label="..." />`
 * 行为:渲染小灰 "?" icon · 点击新窗口打开 /faq#faq-item-{idx}
 *      FaqView 监听 hashchange · 自动展开 + 滚动
 *
 * 服务端可渲染(无 hooks)· 用 next-intl Link 维持当前 locale
 *
 * 维护提示:items 重排时只需更新此文件的 FAQ_TOPIC_TO_IDX 映射
 *           对照 messages/zh-CN.json faq.items 数组的 0-based 索引
 */
import { HelpCircle } from 'lucide-react';
import Link from 'next/link';

export type FaqTopic =
  | 'fee'              // 手续费怎么收
  | 'slippage'         // 什么是滑点
  | 'price-impact'     // 什么是 Price Impact
  | 'tx-failed'        // 交易失败 OKX 显示「请联系客服」
  | 'wsol-double'      // 为什么看到 -0.02 SOL 和 -0.02 WSOL
  | 'wallet'           // 用什么钱包
  | 'mobile'           // 手机端能用吗
  | 'limit-min'        // 限价单最小金额
  | 'limit-fill'       // 限价单多久成交
  | 'alert-notify'     // 到价了没收到通知
  | 'points-earn'      // 积分怎么获得
  | 'points-use'       // 积分能干什么
  | 'security-key'     // 私钥
  | 'security-review'; // 安全审查

// FAQ topic → /messages 里 items 数组的 0-based 索引
// 当前顺序对照 messages/zh-CN.json faq.items(T-FAQ-126 重排后)
const FAQ_TOPIC_TO_IDX: Record<FaqTopic, number> = {
  'fee': 0,
  'slippage': 1,
  'price-impact': 2,
  'tx-failed': 3,
  'wsol-double': 4,
  'wallet': 5,
  'mobile': 6,
  'limit-min': 7,
  'limit-fill': 8,
  'alert-notify': 9,
  'points-earn': 10,
  'points-use': 11,
  'security-key': 12,
  'security-review': 13,
};

interface Props {
  topic: FaqTopic;
  label: string;
  className?: string;
}

export function FaqHelpIcon({ topic, label, className = '' }: Props) {
  const idx = FAQ_TOPIC_TO_IDX[topic];
  return (
    <Link
      href={`/faq#faq-item-${idx}`}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center text-muted-foreground/50 hover:text-primary transition-colors ${className}`}
    >
      <HelpCircle className="h-3 w-3" />
    </Link>
  );
}
