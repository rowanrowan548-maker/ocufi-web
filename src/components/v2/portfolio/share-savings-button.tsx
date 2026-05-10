'use client';

/**
 * P5-FE-26 · 累计省下卡分享按钮
 *
 * 复用 tx-view 的 deeplink + tweet/copy/telegram 模式
 * URL: https://www.ocufi.io/saved/<wallet>
 * 文案 i18n: v2.portfolio.savings.share.shareText
 */
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type Props = {
  wallet: string;
  savedSol: number;
  tradeCount: number;
  solDp?: number;
};

function fmtNum(n: number, dp = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function ShareSavingsButton({ wallet, savedSol, tradeCount, solDp = 4 }: Props) {
  const t = useTranslations('v2.portfolio.savings.share');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.ocufi.io';
  // P5-FE-26-hotfix · ?v=YYYYMMDD cache-buster · X / TG / Slack 当新链接重抓 OG · 防 deploy 期"无图"被永久缓存
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const shareUrl = `${baseUrl}/saved/${wallet}?v=${today}`;
  const shareText = t('shareText', {
    savedSol: fmtNum(savedSol, solDp),
    trades: String(tradeCount),
  });

  // 复用 tx-view tryDeeplink 模式 · app 装了 deeplink 直开 · 没装 web fallback
  const tryDeeplink = (deeplink: string, fallback: string) => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent;
    const isMobile = /iPhone|iPad|Android|Mobile/i.test(ua);
    if (!isMobile) {
      window.open(fallback, '_blank', 'noopener,noreferrer');
      return;
    }
    let didFallback = false;
    const fallbackTimer = window.setTimeout(() => {
      didFallback = true;
      window.location.href = fallback;
    }, 1_200);
    const onHide = () => {
      if (didFallback) return;
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('blur', onHide);
    };
    window.addEventListener('pagehide', onHide, { once: true });
    window.addEventListener('blur', onHide, { once: true });
    window.location.href = deeplink;
  };

  const handleTweet = () => {
    const text = `${shareText} ${shareUrl}`;
    tryDeeplink(
      `twitter://post?message=${encodeURIComponent(text)}`,
      `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    );
  };
  const handleCopy = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast(t('copied'));
    } catch {
      toast(t('copied'));
    }
  };
  const handleTelegram = () => {
    tryDeeplink(
      `tg://msg_url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--ink-40)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {t('label')}
      </span>
      <ShareSmallBtn onClick={handleTweet}>{t('tweet')}</ShareSmallBtn>
      <ShareSmallBtn onClick={handleCopy}>{t('copy')}</ShareSmallBtn>
      <ShareSmallBtn onClick={handleTelegram}>{t('telegram')}</ShareSmallBtn>
    </div>
  );
}

function ShareSmallBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v2-share-savings-btn"
      style={{
        background: 'transparent',
        border: '1px solid var(--border-strong, rgba(255,255,255,0.14))',
        color: 'var(--ink-60)',
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'border-color 120ms ease, color 120ms ease',
      }}
    >
      {children}
    </button>
  );
}
