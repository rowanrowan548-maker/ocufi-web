'use client';

import { useCallback, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import {
  WalletError,
  WalletNotReadyError,
  WalletConnectionError,
  WalletDisconnectionError,
  WalletTimeoutError,
  WalletWindowClosedError,
} from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import '@solana/wallet-adapter-react-ui/styles.css';
import './wallet-modal-polish.css';
import { getCurrentChain } from '@/config/chains';
import { PhantomConnectProvider } from './phantom-connect-provider';

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const chain = getCurrentChain();
  const endpoint = useMemo(() => chain.rpcUrl, [chain.rpcUrl]);
  const t = useTranslations('wallet.errors');

  // 显式注册主流 adapter 作为保险。OKX、Backpack 等支持 wallet-standard 的钱包
  // wallet-adapter-react 会自动发现并追加。
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  );

  // T-INV-165 · 钱包错误友好化
  // 默认 wallet-adapter 把 stack trace 直接 console.error · 不告诉用户怎么办
  // 这里把已知 case 翻译成中文友好 toast
  const onError = useCallback((err: WalletError) => {
    if (err instanceof WalletWindowClosedError) return;           // 用户关弹窗,无需提示
    if (err instanceof WalletNotReadyError) {
      toast.error(t('notReady'));
    } else if (err instanceof WalletTimeoutError) {
      toast.error(t('timeout'));
    } else if (err instanceof WalletDisconnectionError) {
      toast.error(t('disconnect'));
    } else if (err instanceof WalletConnectionError) {
      // 含用户拒绝 + 钱包扩展未装 + 网络问题等多种 case
      const msg = String(err.message || '');
      if (/reject|cancel|denied|dismiss/i.test(msg)) {
        toast.error(t('userRejected'));
      } else if (/not installed|not detected|undefined/i.test(msg)) {
        toast.error(t('notInstalled'));
      } else {
        toast.error(t('connectFailed', { reason: msg.slice(0, 60) || 'unknown' }));
      }
    } else {
      // 兜底
      toast.error(t('generic', { reason: (err.message || err.name).slice(0, 60) }));
    }
    // eslint-disable-next-line no-console
    console.warn('[wallet]', err);
  }, [t]);

  return (
    <PhantomConnectProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect onError={onError}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </PhantomConnectProvider>
  );
}
