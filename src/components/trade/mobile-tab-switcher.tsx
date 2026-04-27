'use client';

/**
 * 移动端 5 tab 切换条(T-505a)
 *
 * 横向滚动,选中态高亮 + 下划线。仅在 < lg 用,桌面端不渲染本组件
 * (由父组件 trade-screen 的 lg:hidden 控制可见性)。
 */
import { useTranslations } from 'next-intl';
import {
  LineChart,
  Info,
  BarChart3,
  ShieldAlert,
  Activity,
} from 'lucide-react';

export type MobileTab = 'chart' | 'detail' | 'data' | 'risk' | 'activity';

const TABS: { value: MobileTab; Icon: typeof LineChart }[] = [
  { value: 'chart', Icon: LineChart },
  { value: 'detail', Icon: Info },
  { value: 'data', Icon: BarChart3 },
  { value: 'risk', Icon: ShieldAlert },
  { value: 'activity', Icon: Activity },
];

interface Props {
  value: MobileTab;
  onChange: (tab: MobileTab) => void;
}

export function MobileTabSwitcher({ value, onChange }: Props) {
  const t = useTranslations('trade.mobileTabs');

  return (
    <div className="flex items-center gap-1 overflow-x-auto -mx-4 px-4 border-b border-border/40">
      {TABS.map(({ value: v, Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t(v)}</span>
          </button>
        );
      })}
    </div>
  );
}
