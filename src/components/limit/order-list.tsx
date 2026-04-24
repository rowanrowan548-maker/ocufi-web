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

const REFRESH_MS = 30_000;

interface Props {
  /** 父组件传入的刷新 tick,订单创建后自增触发重新拉取 */
  refreshTick?: number;
}

export function OrderList({ refreshTick = 0 }: Props) {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [orders, setOrders] = useState<TriggerOrder[]>([]);
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
        if (!cancelled) {
          setOrders(res.orders);
          setErr(null);
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
        <Card className="overflow-hidden">
          <Table>
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
                const { pairLabel, priceLabel, targetMint } = formatPair(o);
                return (
                  <TableRow key={o.orderKey}>
                    <TableCell>
                      <Link
                        href={`/token/${targetMint}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {pairLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatRaw(o.makingAmount, o.inputMint === SOL_MINT ? 9 : 6)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatRaw(o.takingAmount, o.outputMint === SOL_MINT ? 9 : 6)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{priceLabel}</TableCell>
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

function formatPair(o: TriggerOrder): {
  pairLabel: string;
  priceLabel: string;
  targetMint: string;
} {
  // 简单规则:一端是 SOL,另一端是"目标 token"
  const buyingSol = o.outputMint === SOL_MINT;
  const tokenMint = buyingSol ? o.inputMint : o.outputMint;
  const tokenSymbol = tokenMint.slice(0, 4) + '…' + tokenMint.slice(-4);
  const pairLabel = buyingSol ? `${tokenSymbol} → SOL` : `SOL → ${tokenSymbol}`;

  // 价格 = SOL / token(按 9 & 6 精度估算,meme 常见 6 位)
  const tokenDec = 6; // 粗略:真正要准确需要调 getDecimals,这里只显示参考
  const making = Number(o.makingAmount) / 10 ** (o.inputMint === SOL_MINT ? 9 : tokenDec);
  const taking = Number(o.takingAmount) / 10 ** (o.outputMint === SOL_MINT ? 9 : tokenDec);
  const solPerToken = buyingSol ? taking / making : making / taking;
  const priceLabel = `${solPerToken.toExponential(3)} SOL`;

  return { pairLabel, priceLabel, targetMint: tokenMint };
}

function formatRaw(raw: string, decimals: number): string {
  const n = Number(raw) / 10 ** decimals;
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}

function formatExpiry(expiredAt?: string): string {
  if (!expiredAt) return '—';
  const ts = Number(expiredAt);
  if (!ts) return '—';
  const now = Date.now() / 1000;
  const diff = ts - now;
  if (diff <= 0) return 'expired';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
