'use client';

/**
 * T-908a · 桌面 nav 分组 dropdown(每个 group 一个)
 */
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { NavGroup } from './nav-config';

export function NavDropdown({ group }: { group: NavGroup }) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
      >
        {t(group.labelKey)}
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {group.items.map((it) => (
          <DropdownMenuItem
            key={it.href}
            onClick={() => router.push(it.href)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span className={it.placeholder ? 'text-muted-foreground' : ''}>
                {t(it.labelKey)}
              </span>
              {it.placeholder && (
                <span className="text-[9px] uppercase tracking-wider text-primary/70 font-mono ml-3">
                  {t('nav.comingSoon')}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
