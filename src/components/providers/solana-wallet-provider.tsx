'use client';

import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';
import { getCurrentChain } from '@/config/chains';

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const chain = getCurrentChain();
  const endpoint = useMemo(() => chain.rpcUrl, [chain.rpcUrl]);

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

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
