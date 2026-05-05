'use client';

/**
 * V2 Scroll Hint · mobile-only 微闪烁 ↓ · sticky nav 下方
 * position: fixed top: 64px · 暗示用户"下面有更多"
 *
 * 桌面 hidden(用 CSS 控制 · 不渲染额外 DOM)
 */
import { useEffect, useState } from 'react';

export function ScrollHint() {
  const [visible, setVisible] = useState(true);

  // 用户滑了就隐藏(避免一直闪烦)
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 80 && visible) setVisible(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="v2-scroll-hint"
      style={{
        position: 'fixed',
        top: 64,
        left: '50%',
        zIndex: 99,
        fontSize: 14,
        color: 'var(--brand-up)',
        pointerEvents: 'none',
        animation: 'v2-scroll-hint 2s ease-in-out 1.5s infinite',
      }}
    >
      ↓
    </div>
  );
}
