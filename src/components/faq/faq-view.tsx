'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  group: string;
  q: string;
  a: string;
}

export function FaqView() {
  const t = useTranslations('faq');
  const items = t.raw('items') as FaqItem[];
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // 按 group 归类
  const grouped = items.reduce<Record<string, Array<{ idx: number; item: FaqItem }>>>((acc, item, idx) => {
    (acc[item.group] ||= []).push({ idx, item });
    return acc;
  }, {});

  return (
    <div className="w-full max-w-3xl space-y-8">
      {Object.entries(grouped).map(([group, entries]) => (
        <section key={group} className="space-y-3">
          <h2 className="text-lg font-semibold border-b pb-2">{group}</h2>
          <div className="space-y-2">
            {entries.map(({ idx, item }) => {
              const open = openIdx === idx;
              return (
                <div
                  key={idx}
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : idx)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition"
                  >
                    <span className="text-sm font-medium">{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
