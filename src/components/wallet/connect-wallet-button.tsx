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

  // 用 base58 string 依赖,避免 publicKey 对象 ref 不稳定导致 useEffect 风暴
  const addrStr = publicKey?.toBase58() ?? null;

  // 余额:首次拉 + 30s 轮询。不订阅 WS(公共节点的 WS 经常拒绝;Helius 可靠但轮询也够用)
  useEffect(() => {
    if (!addrStr) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchBal = async () => {
      try {
        const pk = publicKey!;
        const lamports = await connection.getBalance(pk, 'confirmed');
        if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (e: unknown) {
        // RPC 403/429 等不吵:打一次 warn 不走 console.error(错误计数别爆)
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          console.warn('[balance]', msg.slice(0, 200));
          setBalance(null);
        }
      }
      if (!cancelled) timer = setTimeout(fetchBal, 30_000);
    };
    fetchBal();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [addrStr, connection, publicKey]);

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          'inline-flex items-center justify-center rounded-md border border-input bg-background ' +
          'text-foreground hover:bg-accent hover:text-accent-foreground ' +
          'transition-colors font-medium focus-visible:outline-none ' +
          'focus-visible:ring-2 focus-visible:ring-ring ' +
          (variant === 'landing'
            ? 'h-11 px-5 text-sm sm:min-w-[200px]'
            : 'h-9 px-3 text-sm')
        }
      >
        <Wallet className="mr-2 h-4 w-4" />
        <span className="font-mono">{shortAddr(addr)}</span>
        {balance !== null && (
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {balance.toFixed(3)} {chain.nativeSymbol}
          </span>
        )}
      </DropdownMenuTrigger>
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
          onClick={() =>
            window.open(`${chain.explorer}/account/${addr}`, '_blank', 'noopener,noreferrer')
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
