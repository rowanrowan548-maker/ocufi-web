'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import { Wallet, LogOut, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { getCurrentChain } from '@/config/chains';

function shortAddr(addr: string) {
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}

interface Props {
  /** 'landing' = 大号 primary 按钮;'header' = 紧凑 outline */
  variant?: 'landing' | 'header';
}

export function ConnectWalletButton({ variant = 'header' }: Props) {
  const t = useTranslations();
  const { connection } = useConnection();
  const { publicKey, disconnect, connected, connecting, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const chain = getCurrentChain();

  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // 拉 SOL 余额 + 订阅变化
  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let cancelled = false;

    const fetchBal = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, 'confirmed');
        if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (e) {
        console.error('[balance]', e);
      }
    };
    fetchBal();

    // 订阅账户变化,SOL 进出立刻更新
    const subId = connection.onAccountChange(
      publicKey,
      (acc) => {
        if (!cancelled) setBalance(acc.lamports / LAMPORTS_PER_SOL);
      },
      { commitment: 'confirmed' }
    );

    return () => {
      cancelled = true;
      connection.removeAccountChangeListener(subId).catch(() => {});
    };
  }, [publicKey, connection]);

  const handleCopy = useCallback(async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }, [publicKey]);

  // 未连接状态
  if (!connected || !publicKey) {
    const openModal = () => setVisible(true);
    if (variant === 'landing') {
      return (
        <Button size="lg" onClick={openModal} disabled={connecting} className="sm:min-w-[200px]">
          {connecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('wallet.connecting')}
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              {t('landing.hero.cta_connect')}
            </>
          )}
        </Button>
      );
    }
    return (
      <Button size="sm" variant="outline" onClick={openModal} disabled={connecting}>
        {connecting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="mr-2 h-4 w-4" />
        )}
        {connecting ? t('wallet.connecting') : t('wallet.connect')}
      </Button>
    );
  }

  // 已连接:主按钮显示地址+余额,下拉菜单管理
  const addr = publicKey.toBase58();
  const triggerBtn = (
    <Button
      size={variant === 'landing' ? 'lg' : 'sm'}
      variant="outline"
      className={variant === 'landing' ? 'sm:min-w-[200px]' : undefined}
    >
      <Wallet className="mr-2 h-4 w-4" />
      <span className="font-mono">{shortAddr(addr)}</span>
      {balance !== null && (
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {balance.toFixed(3)} {chain.nativeSymbol}
        </span>
      )}
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={triggerBtn} />
      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
          {wallet?.adapter.name || t('wallet.connected')}
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-500" />
              {t('wallet.copied')}
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              <span className="font-mono text-xs">{shortAddr(addr)}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {t('wallet.copyAddress')}
              </span>
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          render={
            <a
              href={`${chain.explorer}/account/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {t('wallet.viewExplorer')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => disconnect().catch(() => {})}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('wallet.disconnect')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
