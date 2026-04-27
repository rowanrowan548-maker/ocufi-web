'use client';

/**
 * T-908a/T-910 · 桌面 nav 分组 dropdown(每个 group 一个)· 双行布局
 *
 *  ┌─────────────────────────────────────────────────┐
 *  │ [icon]  主标题                  [Coming Soon]   │
 *  │         副标题描述                              │
 *  └─────────────────────────────────────────────────┘
 */
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { NavGroup } from './nav-config';

type LucideComponent = React.FC<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export function NavDropdown({ group }: { group: NavGroup }) {
  const t = useTranslations();
  const router = useRouter();
  const IconLib = Icons as unknown as Record<string, LucideComponent>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
      >
        {t(group.labelKey)}
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px] p-1">
        {group.items.map((it) => {
          const Icon = it.iconName ? IconLib[it.iconName] : null;
          return (
            <DropdownMenuItem
              key={it.href}
              onClick={() => router.push(it.href)}
              className="cursor-pointer py-2 px-2"
            >
              <div className="flex items-start gap-3 w-full">
                {Icon && (
                  <div
                    className={
                      'h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ' +
                      (it.placeholder
                        ? 'bg-muted/40 text-muted-foreground/60'
                        : 'bg-primary/10 text-primary')
                    }
                  >
                    <Icon size={16} strokeWidth={1.8} />
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={
                        'text-sm font-medium truncate ' +
                        (it.placeholder ? 'text-muted-foreground' : '')
                      }
                    >
                      {t(it.labelKey)}
                    </span>
                    {it.placeholder && (
                      <span className="text-[9px] uppercase tracking-wider text-primary/70 font-mono whitespace-nowrap flex-shrink-0">
                        {t('nav.comingSoon')}
                      </span>
                    )}
                  </div>
                  {it.descKey && (
                    <span className="text-[11px] text-muted-foreground/70 truncate leading-snug mt-0.5">
                      {t(it.descKey)}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
