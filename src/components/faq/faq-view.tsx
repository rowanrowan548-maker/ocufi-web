'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Send, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';

interface FaqItem {
  group: string;
  q: string;
  a: string;
}

type Vote = 'up' | 'down';
const VOTES_KEY = 'ocufi.faq.votes.v1';

function loadVotes(): Record<string, Vote> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(VOTES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Vote>) : {};
  } catch {
    return {};
  }
}

function saveVotes(votes: Record<string, Vote>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  } catch {
    /* noop */
  }
}

export function FaqView() {
  const t = useTranslations('faq');
  const items = t.raw('items') as FaqItem[];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [votes, setVotes] = useState<Record<string, Vote>>({});

  useEffect(() => {
    setVotes(loadVotes());
  }, []);

  const handleVote = (faqId: string, vote: Vote) => {
    if (votes[faqId]) return;
    const next = { ...votes, [faqId]: vote };
    setVotes(next);
    saveVotes(next);
    track('faq_feedback', { faq_id: faqId, vote });
  };

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
                  {open && (() => {
                    const faqId = `${item.group}::${item.q}`;
                    const userVote = votes[faqId];
                    return (
                      <div className="px-4 pb-4 pt-1 space-y-3">
                        <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                          {item.a}
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-xs">
                          {userVote ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Check className="h-3 w-3" />
                              {t('feedback.recorded')}
                            </span>
                          ) : (
                            <>
                              <span className="text-muted-foreground">{t('feedback.prompt')}</span>
                              <button
                                type="button"
                                onClick={() => handleVote(faqId, 'up')}
                                aria-label={t('feedback.helpful')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border/40 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-500 transition"
                              >
                                <ThumbsUp className="h-3 w-3" />
                                <span>{t('feedback.helpful')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVote(faqId, 'down')}
                                aria-label={t('feedback.notHelpful')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border/40 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-500 transition"
                              >
                                <ThumbsDown className="h-3 w-3" />
                                <span>{t('feedback.notHelpful')}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
            <Send className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold">{t('cta.title')}</h3>
          <p className="text-sm text-muted-foreground max-w-md">{t('cta.subtitle')}</p>
          <a
            href="https://t.me/+HucmvmOx2IswZDBl"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'lg' }), 'mt-2 gap-2')}
          >
            <Send className="h-4 w-4" />
            {t('cta.button')}
          </a>
        </div>
      </Card>
    </div>
  );
}
