'use client';

/**
 * Root-级 Error Boundary · 当 layout 自己崩溃时兜底
 *
 * 这里必须自带 <html> + <body>(Next 不会包装上层 layout)
 * 设计走极简灰底,不依赖任何 i18n / 主题 / Tailwind tokens 之外的资源,
 * 因为这个文件可能在所有 provider 都炸了的情况下渲染
 */
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="zh-CN" className="dark">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0a0a0a',
          color: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            出了点意外
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#a1a1aa',
              marginBottom: 24,
              lineHeight: 1.5,
            }}
          >
            页面加载失败,请刷新重试。如果问题持续,可以稍后再来。
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                color: '#71717a',
                fontFamily: 'monospace',
                marginBottom: 16,
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: '#19FB9B',
              color: '#0a0a0a',
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
