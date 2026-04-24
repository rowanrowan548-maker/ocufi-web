'use client';

/**
 * 限价单列表 + 取消
 *
 * Jupiter Trigger API:
 *   GET /trigger/v1/getTriggerOrders?user=X&orderStatus=active
 *   POST /trigger/v1/cancelOrder
 */
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { RefreshCw, X, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getCurrentChain } from '@/config/chains';
import {
  cancelTriggerOrder, getTriggerOrders, type TriggerOrder,
} from '@/lib/jupiter-trigger';
import { signAndSendTx, confirmTx } from '@/lib/trade-tx';
import { humanize } from '@/lib/friendly-error';
import { track } from '@/lib/analytics';
import { SOL_MINT } from '@/lib/jupiter';
import { fetchTokensInfoBatch, type TokenInfo } from '@/lib/portfolio';

const REFRESH_MS = 30_000;

interface Props {
  refreshTick?: number;
}

export function OrderList({ refreshTick = 0 }: Props) {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [orders, setOrders] = useState<TriggerOrder[]>([]);
  const [tokenInfos, setTokenInfos] = useState<Map<string, TokenInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cancellingKey, setCancellingKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const userPk = wallet.publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!userPk) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await getTriggerOrders(userPk, 'active');
        if (cancelled) return;
        setOrders(res.orders);
        setErr(null);

        // 补齐 token 符号/图标
        const mints = new Set<string>();
        for (const o of res.orders) {
          if (o.inputMint !== SOL_MINT) mints.add(o.inputMint);
          if (o.outputMint !== SOL_MINT) mints.add(o.outputMint);
        }
        if (mints.size > 0) {
          const infos = await fetchTokensInfoBatch([...mints]);
          if (!cancelled) setTokenInfos(infos);
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) timer = setTimeout(load, REFRESH_MS);
    };
    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userPk, tick, refreshTick]);

  async function handleCancel(order: TriggerOrder) {
    if (!wallet.publicKey) return;
    setCancellingKey(order.orderKey);
    setErr(null);
    try {
      const res = await cancelTriggerOrder({
        maker: wallet.publicKey.toBase58(),
        order: order.orderKey,
      });
      const tx = VersionedTransaction.deserialize(Buffer.from(res.transaction, 'base64'));
      const sig = await signAndSendTx(connection, wallet, tx);
      await confirmTx(connection, sig, 60_000);
      track('limit_order_cancelled', { orderKey: order.orderKey });
      refresh();
    } catch (e: unknown) {
      setErr(humanize(e));
    } finally {
      setCancellingKey(null);
    }
  }

  if (!wallet.connected || !userPk) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('limit.orders.title')}</h2>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-8 px-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {err && (
        <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-all">{err}</span>
        </div>
      )}

      {orders.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('limit.orders.empty')}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('limit.orders.pair')}</TableHead>
                <TableHead className="text-right">{t('limit.orders.making')}</TableHead>
                <TableHead className="text-right">{t('limit.orders.taking')}</TableHead>
                <TableHead className="text-right">{t('limit.orders.price')}</TableHead>
                <TableHead className="text-right">{t('limit.orders.expiry')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const v = computeView(o, tokenInfos);
                return (
                  <TableRow key={o.orderKey}>
                    <TableCell>
                      <Link
                        href={`/token/${v.targetMint}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {v.tokenLogo ? (
                            <Image
                              src={v.tokenLogo}
                              alt={v.tokenSymbol}
                              width={24}
                              height={24}
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {v.tokenSymbol.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium">{v.pairLabel}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{v.makingDisplay}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{v.takingDisplay}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{v.priceDisplay}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatExpiry(o.expiredAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <a
                          href={`${chain.explorer}/account/${o.orderKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex p-1 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(o)}
                          disabled={cancellingKey === o.orderKey}
                          className="h-7 px-2 text-destructive hover:text-destructive"
                        >
                          {cancellingKey === o.orderKey ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

interface OrderView {
  tokenSymbol: string;
  tokenLogo?: string;
  targetMint: string;
  pairLabel: string;         // "SOL → PUMP" 或 "PUMP → SOL"
  makingDisplay: string;     // "0.07 SOL" / "70000 PUMP"
  takingDisplay: string;
  priceDisplay: string;      // "0.000001 SOL/枚"
}

function computeView(o: TriggerOrder, infos: Map<string, TokenInfo>): OrderView {
  const buyingSol = o.outputMint === SOL_MINT;
  const targetMint = buyingSol ? o.inputMint : o.outputMint;
  const info = infos.get(targetMint);
  const tokenSymbol = info?.symbol ?? targetMint.slice(0, 4) + '…' + targetMint.slice(-4);
  const tokenLogo = info?.logoUri;
  const pairLabel = buyingSol ? `${tokenSymbol} → SOL` : `SOL → ${tokenSymbol}`;

  const makingNum = Number(o.makingAmount);
  const takingNum = Number(o.takingAmount);
  const makingIsSol = o.inputMint === SOL_MINT;
  const takingIsSol = o.outputMint === SOL_MINT;
  const makingLabel = makingIsSol ? 'SOL' : tokenSymbol;
  const takingLabel = takingIsSol ? 'SOL' : tokenSymbol;

  // 价格:SOL per 枚 token
  const tokenAmount = buyingSol ? makingNum : takingNum;
  const solAmount = buyingSol ? takingNum : makingNum;
  const solPerToken = tokenAmount > 0 ? solAmount / tokenAmount : 0;

  return {
    tokenSymbol,
    tokenLogo,
    targetMint,
    pairLabel,
    makingDisplay: `${fmt(makingNum)} ${makingLabel}`,
    takingDisplay: `${fmt(takingNum)} ${takingLabel}`,
    priceDisplay: `${fmt(solPerToken)} SOL`,
  };
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  if (n >= 0.00000001) return n.toFixed(9);
  // 极小数,用压缩零格式不会出现 "e-x" 的歧义
  const s = n.toFixed(20).replace(/0+$/, '');
  return s.length > 12 ? s.slice(0, 12) + '…' : s;
}

function formatExpiry(expiredAt?: string): string {
  if (!expiredAt) return '—';
  const ts = Date.parse(expiredAt);
  if (!ts) return '—';
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return 'expired';
  const sec = diffMs / 1000;
  if (sec < 60) return `${Math.floor(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
