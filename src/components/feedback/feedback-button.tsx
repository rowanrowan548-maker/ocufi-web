'use client';

/**
 * 全站反馈入口 · 浮动按钮 + 弹窗
 *
 * T-944 重排 · 中文用户优先(主推 TG):
 *  1. 大绿色 TG 群按钮(主推)→ tg://+HucmvmOx2IswZDBl
 *  2. 中按钮 Twitter @Ocufi_io DM(英文用户)
 *  3. 灰色小字 GitHub Issue(技术 bug · 开发者用)
 *  4. 已知问题链接 → GitHub Issues 列表
 */
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageSquare, X, ListChecks, ExternalLink } from 'lucide-react';
import { TelegramIcon, XIcon, GithubIcon } from '@/components/brand/social-icons';

const TG_GROUP_URL = 'https://t.me/+HucmvmOx2IswZDBl';
const GITHUB_REPO = 'rowanrowan548-maker/ocufi-web';
const GITHUB_NEW_ISSUE = `https://github.com/${GITHUB_REPO}/issues/new`;
const GITHUB_ISSUES_LIST = `https://github.com/${GITHUB_REPO}/issues`;
const TWITTER_HANDLE = 'Ocufi_io';
const TWITTER_DM_URL = `https://x.com/messages/compose?recipient_id=${TWITTER_HANDLE}`;
const TWITTER_PROFILE_URL = `https://x.com/${TWITTER_HANDLE}`;

export function FeedbackButton() {
  const t = useTranslations('feedback');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // T-926 #44:trade 页隐藏(FAB 遮挡 buy 按钮)
  if (/^\/[a-z]{2}-[A-Z]{2}\/trade(\/|$|\?)/.test(pathname ?? '')) {
    return null;
  }
  // P2-MOBILE-OVERHAUL #1:V2 路径全 hide · FAB 跟 V2 bottom-tab-bar 多层叠 + 视觉断
  // 等 Phase 4 V2 mv 顶层后再视觉融入
  if (pathname?.includes('/v2/') || pathname?.endsWith('/v2')) {
    return null;
  }

  return (
    <>
      {/* 浮动按钮 · 右下角 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('label')}
        className="fixed bottom-24 lg:bottom-4 right-4 z-40 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-background h-11 w-11 sm:w-auto sm:px-4 shadow-lg hover:opacity-90 transition-opacity text-sm font-medium"
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

            <div className="px-5 pb-5 space-y-3">
              {/* T-944 #136 · TG 主推大绿色 · 中文用户优先 */}
              <a
                href={TG_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={TG_GROUP_URL}
                onClick={() => setOpen(false)}
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary/90 text-background text-sm font-medium transition-colors"
              >
                <TelegramIcon className="h-5 w-5" />
                <span>{t('channels.tgPrimary')}</span>
              </a>
              <div className="text-[11px] text-center text-muted-foreground/80">
                {t('languageHint')}
              </div>

              {/* Twitter 中按钮 · 英文用户 */}
              <a
                href={TWITTER_DM_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={TWITTER_DM_URL}
                onClick={() => setOpen(false)}
                className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background hover:bg-muted/40 text-foreground text-sm transition-colors"
              >
                <XIcon className="h-4 w-4" />
                <span>{t('channels.twitterSecondary')}</span>
              </a>

              {/* GitHub 灰色小字 · 技术 bug · 开发者用 */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <a
                    href={GITHUB_NEW_ISSUE}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={GITHUB_NEW_ISSUE}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <GithubIcon className="h-3 w-3" />
                    <span>{t('channels.githubTertiary')}</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </a>
                  {/* T-944 #139 · 已知问题链接 */}
                  <a
                    href={GITHUB_ISSUES_LIST}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={GITHUB_ISSUES_LIST}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <ListChecks className="h-3 w-3" />
                    <span>{t('knownIssues')}</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </a>
                </div>
                <div className="text-[10px] text-muted-foreground/60 leading-relaxed">
                  {t('githubHint')} ·{' '}
                  <a
                    href={TWITTER_PROFILE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    @{TWITTER_HANDLE}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
