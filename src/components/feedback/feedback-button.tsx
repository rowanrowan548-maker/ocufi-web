'use client';

/**
 * 全站反馈入口 · 浮动按钮 + 弹窗
 *
 * 弹窗内 3 个渠道:
 *  - TG 群:跳官方 TG 链接
 *  - GitHub Issue:用户填好标题/内容,点提交 → 跳 prefilled GitHub Issue 创建页
 *  - Twitter:跳 @Ocufi_io 私信
 *
 * V2 接后端 /feedback API 后,可改成站内提交,这里继续保留 GitHub Issue 路径作为公开备案
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TG_GROUP_URL = 'https://t.me/ocufi';
const GITHUB_REPO = 'rowanrowan548-maker/ocufi-web';
const TWITTER_HANDLE = 'Ocufi_io';

export function FeedbackButton() {
  const t = useTranslations('feedback');
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  function submitToGitHub() {
    const title = encodeURIComponent(subject.slice(0, 100) || 'Feedback');
    const description =
      `${body}\n\n---\nUA: ${navigator.userAgent}\nURL: ${window.location.href}`.slice(0, 4000);
    const url =
      `https://github.com/${GITHUB_REPO}/issues/new?title=${title}` +
      `&body=${encodeURIComponent(description)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
    setSubject('');
    setBody('');
  }

  return (
    <>
      {/* 浮动按钮 · 右下角 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('label')}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-background h-11 px-4 shadow-lg hover:opacity-90 transition-opacity text-sm font-medium"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">{t('label')}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md bg-card border border-border/60 rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <div className="text-base font-semibold">{t('title')}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-muted/40 rounded transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* 三个快速渠道 */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={TG_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-3 rounded-md border border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xl">💬</span>
                  <span className="text-[10px] text-muted-foreground">{t('channels.tg')}</span>
                </a>
                <a
                  href={`https://github.com/${GITHUB_REPO}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-3 rounded-md border border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xl">⌥</span>
                  <span className="text-[10px] text-muted-foreground">{t('channels.github')}</span>
                </a>
                <a
                  href={`https://x.com/${TWITTER_HANDLE}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-3 rounded-md border border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xl">𝕏</span>
                  <span className="text-[10px] text-muted-foreground">{t('channels.twitter')}</span>
                </a>
              </div>

              <div className="text-[11px] text-muted-foreground/70 text-center pt-1 border-t border-border/40">
                {t('orInline')}
              </div>

              {/* 表单 → 提交到 GitHub Issue */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, 100))}
                  placeholder={t('form.subject')}
                  maxLength={100}
                  className="w-full h-10 px-3 rounded-md border border-border/60 bg-background text-sm focus:outline-none focus:border-primary/50"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 2000))}
                  placeholder={t('form.body')}
                  maxLength={2000}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md border border-border/60 bg-background text-sm focus:outline-none focus:border-primary/50 resize-none"
                />
                <Button
                  onClick={submitToGitHub}
                  disabled={!subject.trim() && !body.trim()}
                  className="w-full"
                  size="sm"
                >
                  <Send className="h-3.5 w-3.5 mr-2" />
                  {t('form.submit')}
                </Button>
                <div className="text-[10px] text-muted-foreground/70 text-center">
                  {t('form.hint')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
