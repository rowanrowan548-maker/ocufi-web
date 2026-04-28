/**
 * T-980-123 · 应用内集成 "?" deep link
 *
 * 使用:`<DocsHelpIcon target="adv-priority-fee" label="..." />`
 * 行为:渲染小灰 "?" icon · 点击新窗口打开 /docs#{target}
 * 服务端可渲染(无 hooks · 不引入新外部依赖)· 用 next-intl Link 维持当前 locale
 */
import { HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface Props {
  /** /docs 锚点 ID(不带 #)· 例 "section-buy" / "adv-priority-fee" / "err-tx-failed" */
  target: string;
  /** 无障碍 label · 也用作 title tooltip */
  label: string;
  /** 默认 inline-flex · 可加自定义 className */
  className?: string;
}

export function DocsHelpIcon({ target, label, className = '' }: Props) {
  return (
    <Link
      href={`/docs#${target}`}
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
