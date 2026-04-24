'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  href: string;
  label: string;
}

interface Props {
  label: string;
  items: NavItem[];
}

export function MoreMenu({ label, items }: Props) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {items.map((it) => (
          <DropdownMenuItem
            key={it.href}
            onClick={() => router.push(it.href)}
            className="cursor-pointer"
          >
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
