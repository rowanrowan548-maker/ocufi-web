'use client';

/**
 * V2 nav 语言切换 · 中 / EN segmented toggle
 *
 * P3-FE-9 · 用户原话"得把切换按钮放哪个位置 · 不然识别手机语言自动切换"
 * 配合 proxy.ts auto-detect · 用户主动切了写 cookie · 下次再来固定
 *
 * 复用 V1 settings-menu 的 switchLocale 逻辑(L187):
 *   - usePathname() 拿当前 (next/navigation 返带 locale 前缀的全 path)
 *   - 砍前缀 + 加新 locale + router.push
 *   - 加 NEXT_LOCALE cookie 90 天 · proxy.ts auto-detect 优先用
 */
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

const COOKIE_MAX_AGE = 90 * 24 * 3600;

export function LangSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  function switchTo(target: 'zh-CN' | 'en-US') {
    if (target === locale) return;
    document.cookie = `NEXT_LOCALE=${target};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
    const stripped = pathname.replace(/^\/(zh-CN|en-US)(?=\/|$)/, '') || '/';
    router.push(`/${target}${stripped}`);
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="v2-lang-switch"
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        border: '1px solid var(--border-v2)',
        borderRadius: 999,
        overflow: 'hidden',
        height: 32,
      }}
    >
      <LangBtn active={locale === 'zh-CN'} onClick={() => switchTo('zh-CN')} label="中" />
      <LangBtn active={locale === 'en-US'} onClick={() => switchTo('en-US')} label="EN" />
    </div>
  );
}

function LangBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0 12px',
        background: active ? 'var(--brand-soft)' : 'transparent',
        color: active ? 'var(--brand-up)' : 'var(--ink-60)',
        border: 0,
        cursor: active ? 'default' : 'pointer',
        font: 'inherit',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </button>
  );
}
