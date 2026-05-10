'use client';

/**
 * V2 Home Input · 中央单输入
 * - 粘贴 Solana base58 mint 地址(32-44 字符)→ 跳 /token/<mint>
 * - 否则当 symbol 搜 → 走 /search/tokens(debounce 250ms)· 第一条结果跳转
 *
 * 视觉对齐 mockup `.home-input` · 玻璃 border-strong · brand glow on focus
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { fetchSearchTokens } from '@/lib/api-client';

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function HomeInput() {
  const t = useTranslations('v2.home');
  const router = useRouter();
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    setErr(null);

    if (MINT_RE.test(q)) {
      start(() => router.push(`/token/${q}`));
      return;
    }

    start(async () => {
      try {
        const items = await fetchSearchTokens(q, 1);
        const first = items?.[0];
        if (first?.mint) {
          router.push(`/token/${first.mint}`);
        } else {
          setErr(t('inputNoResult'));
        }
      } catch {
        setErr(t('inputError'));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 580, margin: 0, position: 'relative' }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 22,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--ink-40)',
          fontSize: 18,
          pointerEvents: 'none',
        }}
      >
        ⌕
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
        placeholder={t('inputPlaceholder')}
        style={{
          width: '100%',
          padding: '22px 24px 22px 56px',
          background: 'var(--bg-card-v2)',
          border: '1px solid var(--border-v2-strong)',
          borderRadius: 14,
          color: 'var(--ink-100)',
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 14,
          outline: 'none',
          boxShadow: 'var(--shadow-card-v2)',
          opacity: pending ? 0.6 : 1,
        }}
        className="v2-home-input"
      />
      {err && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--warn, #FF6B6B)',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          }}
        >
          {err}
        </div>
      )}
    </form>
  );
}
