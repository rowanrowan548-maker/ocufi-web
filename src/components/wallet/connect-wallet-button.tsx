'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Wallet, LogOut, ExternalLink, Copy, Check, Loader2, ArrowRight } from 'lucide-react';
import { WalletAvatar } from './wallet-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { getCurrentChain } from '@/config/chains';
import { track } from '@/lib/analytics';

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

  // 钱包连接成功事件(addrStr 从 null → 有值时触发一次)
  useEffect(() => {
    if (addrStr) {
      track('wallet_connect', { wallet: addrStr, adapter: wallet?.adapter.name ?? 'unknown' });
    }
  }, [addrStr, wallet]);

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

  // 已连接
  const addr = publicKey.toBase58();

  // landing 模式已连接 → 不显示钱包,直接 CTA 去交易
  if (variant === 'landing') {
    return (
      <Link href="/trade" className="w-full sm:w-auto">
        <Button size="lg" className="w-full sm:min-w-[200px]">
          {t('landing.hero.cta_start')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          'inline-flex items-center justify-center gap-2 rounded-md border border-border/60 bg-card ' +
          'text-foreground hover:bg-accent hover:border-primary/40 ' +
          'transition-colors font-medium focus-visible:outline-none ' +
          'focus-visible:ring-2 focus-visible:ring-ring ' +
          'h-9 pl-2 pr-3 text-sm'
        }
      >
        <WalletAvatar address={addr} size={20} />
        <span className="font-mono text-xs">{shortAddr(addr)}</span>
        {balance !== null && (
          <span className="font-mono text-xs text-muted-foreground border-l border-border/60 pl-2">
            {balance.toFixed(3)} {chain.nativeSymbol}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[260px]">
        {/* 头部 · 头像 + 地址 + 余额 */}
        <div className="flex items-center gap-3 px-3 py-3 border-b border-border/40">
          <WalletAvatar address={addr} size={36} />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-xs truncate">{shortAddr(addr)}</div>
            <div className="text-[10px] text-muted-foreground">
              {wallet?.adapter.name || t('wallet.connected')}
            </div>
          </div>
          {balance !== null && (
            <div className="text-right">
              <div className="font-mono text-sm font-semibold">{balance.toFixed(3)}</div>
              <div className="text-[10px] text-muted-foreground">{chain.nativeSymbol}</div>
            </div>
          )}
        </div>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="sr-only">
            {wallet?.adapter.name || t('wallet.connected')}
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4 text-success" />
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
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            track('wallet_disconnect', { wallet: addr });
            disconnect().catch(() => {});
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('wallet.disconnect')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
