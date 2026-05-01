'use client';

/**
 * T-PHANTOM-CONNECT-fe · "通过 Phantom Connect 连接" 大按钮
 *
 * 行为:
 *  - 点击调 SDK useModal().show() 弹 Phantom Connect 官方弹窗(google / apple / phantom 三轨)
 *  - 已配置 NEXT_PUBLIC_PHANTOM_APP_ID 时显;否则隐藏(由 isPhantomConnectConfigured 守护)
 *  - 错误友好化(同 T-INV-165 风格 toast)
 *
 * 注意:Phantom Connect SDK 走自己的 connection 状态,不走 @solana/wallet-adapter
 *      连接成功后用户 publicKey 在 SDK 的 useAccounts() 里,下游交易代码
 *      仍读 @solana/wallet-adapter 的 useWallet() — 这是 V1 的妥协,Phantom
 *      Portal 通过审核所必须的"明确集成"。完整 bridge 是后续 V2 工作。
 */
import { useTranslations } from 'next-intl';
import { useModal, usePhantom } from '@phantom/react-sdk';
import { Button } from '@/components/ui/button';
import { isPhantomConnectConfigured } from '@/lib/phantom-connect';
import { toast } from 'sonner';

interface Props {
  /** 'landing' = 大紫色 · 'header' = 紧凑 · 'modal' = wallet modal 顶部专属 */
  variant?: 'landing' | 'header' | 'modal';
  /** 点击后回调(用于关闭外层 modal 等) */
  onAfterClick?: () => void;
}

const PHANTOM_LOGO_SVG = (
  <svg width="20" height="20" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <linearGradient id="phantom-grad" x1="64" y1="0" x2="64" y2="128" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#534BB1"/>
      <stop offset="1" stopColor="#551BF9"/>
    </linearGradient>
    <rect width="128" height="128" rx="64" fill="url(#phantom-grad)"/>
    <path d="M110.6 64.5h-12.5c0-25.4-20.6-46-46-46s-46 20.6-46 46c0 24.5 19.1 44.6 43.2 46v-15c-12.6-.6-22.6-11-22.6-23.7 0-13.1 10.6-23.7 23.7-23.7 13 0 23.6 10.6 23.7 23.6v.6h-12.6c0 7 5.6 12.6 12.6 12.6h.5l9.5 11.6 9.4-11.6c8.4 0 16.7-9.1 17.1-20.4z" fill="#FFFFFF"/>
  </svg>
);

export function PhantomConnectButton({ variant = 'modal', onAfterClick }: Props) {
  const t = useTranslations('wallet.phantomConnect');

  // 守护:env 未配置时不渲染
  if (!isPhantomConnectConfigured()) return null;

  return <PhantomConnectButtonInner variant={variant} onAfterClick={onAfterClick} t={t} />;
}

// SDK hook 必须在 PhantomProvider context 内才能调用
// 外层 isPhantomConnectConfigured() 已守护,这里安全用 useModal()
type T = ReturnType<typeof useTranslations>;
function PhantomConnectButtonInner({
  variant, onAfterClick, t,
}: { variant: 'landing' | 'header' | 'modal'; onAfterClick?: () => void; t: T }) {
  const modal = useModal();
  // T1.1:开 modal 前清掉 autoConnect 残留错(防顶部红条吓用户)
  // PhantomCleanupGuard 已自动 disconnect · 这里再保底清一遍
  const { clearError } = usePhantom();

  const handleClick = () => {
    try {
      clearError('connect');
      modal.open();
      onAfterClick?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('error', { reason: msg.slice(0, 60) || 'unknown' }));
    }
  };

  if (variant === 'header') {
    return (
      <Button
        size="sm"
        onClick={handleClick}
        className="gap-1.5 bg-[#551BF9] hover:bg-[#4316d4] text-white"
      >
        {PHANTOM_LOGO_SVG}
        <span className="hidden sm:inline">{t('buttonShort')}</span>
      </Button>
    );
  }

  if (variant === 'landing') {
    return (
      <Button
        size="lg"
        onClick={handleClick}
        className="w-full sm:min-w-[260px] gap-2 bg-[#551BF9] hover:bg-[#4316d4] text-white"
      >
        {PHANTOM_LOGO_SVG}
        {t('button')}
      </Button>
    );
  }

  // 'modal' variant — 大块占满宽度,顶部专属
  return (
    <Button
      size="lg"
      onClick={handleClick}
      className="w-full gap-2 h-12 bg-[#551BF9] hover:bg-[#4316d4] text-white"
    >
      {PHANTOM_LOGO_SVG}
      {t('button')}
    </Button>
  );
}
