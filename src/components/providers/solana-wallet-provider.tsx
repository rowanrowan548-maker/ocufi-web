'use client';

import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import { getCurrentChain } from '@/config/chains';

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const chain = getCurrentChain();
  const endpoint = useMemo(() => chain.rpcUrl, [chain.rpcUrl]);

  // 空数组:让 wallet-standard 自动发现支持的钱包(Phantom、Solflare、Backpack 等)
  // V1 预留 walletAdapters 清单在 chainConfig 里,V2 若需要再手动 new adapter 实例
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
