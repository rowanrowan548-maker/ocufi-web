'use client';

/**
 * 成交历史页 UI
 * 未连接钱包 → 提示连接
 * 加载中     → 骨架提示
 * 空数据     → 空状态
 * 有数据     → 表格:时间 / 类型 / 代币 / 数量 / SOL / Solscan
 */
import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import {
  RefreshCw, Wallet, AlertCircle, ExternalLink,
  ArrowDownToLine, ArrowUpFromLine, ArrowDownLeft, ArrowUpRight, Minus, Gift,
  CheckCircle2, XCircle, RotateCw,
} from 'lucide-react';
import { track } from '@/lib/analytics';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTxHistory, type EnrichedTxRecord } from '@/hooks/use-tx-history';
import { getCurrentChain } from '@/config/chains';

export function HistoryView() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { records, loading, error, refresh } = useTxHistory(100);

  useEffect(() => {
    if (wallet.publicKey) {
      track('history_view', { wallet: wallet.publicKey.toBase58() });
    }
  }, [wallet.publicKey]);

  if (!wallet.connected || !wallet.publicKey) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('history.notConnected')}</p>
          <Button onClick={() => openWalletModal(true)}>
            {t('wallet.connect')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('history.countHint', { n: records.length })}
        </p>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-8 px-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {!loading && records.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-muted-foreground">{t('history.empty')}</p>
            <Link href="/trade">
              <Button>{t('portfolio.goTrade')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('history.columns.time')}</TableHead>
                <TableHead>{t('history.columns.type')}</TableHead>
                <TableHead className="w-[60px]">{t('history.columns.status')}</TableHead>
                <TableHead>{t('history.columns.token')}</TableHead>
                <TableHead className="text-right">{t('history.columns.tokenAmount')}</TableHead>
                <TableHead className="text-right">{t('history.columns.solAmount')}</TableHead>
                <TableHead className="font-mono text-[11px]">{t('history.columns.signature')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <HistoryRow key={r.signature} r={r} explorer={chain.explorer} t={t} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function HistoryRow({
  r,
  explorer,
  t,
}: {
  r: EnrichedTxRecord;
  explorer: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const typeLabel = t(`history.type.${r.type}`);
  const { Icon, color } = TYPE_STYLE[r.type];

  return (
    <TableRow className={r.err ? 'bg-destructive/5' : ''}>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatTime(r.blockTime)}
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
          <Icon className="h-3.5 w-3.5" />
          {typeLabel}
        </span>
      </TableCell>
      <TableCell>
        {r.err ? (
          <span className="inline-flex items-center gap-1 text-xs text-destructive" title={t('history.status.failed')}>
            <XCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('history.status.failed')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-success" title={t('history.status.success')}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('history.status.success')}</span>
          </span>
        )}
      </TableCell>
      <TableCell>
        {r.type === 'nft_airdrop' || r.type === 'nft' ? (
          <div className="flex items-center gap-2 max-w-[220px]">
            <Gift className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <span className="text-sm font-medium truncate" title={r.nftName || r.description}>
              {r.nftName || r.description || t('history.type.nft_airdrop')}
            </span>
          </div>
        ) : r.tokenMint ? (
          <Link
            href={`/trade?mint=${r.tokenMint}`}
            className="flex items-center gap-2 hover:underline"
          >
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {r.tokenLogo ? (
                <Image
                  src={r.tokenLogo}
                  alt={r.tokenSymbol}
                  width={24}
                  height={24}
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground">
                  {r.tokenSymbol.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-sm font-medium truncate max-w-[140px]">{r.tokenSymbol}</span>
          </Link>
        ) : r.solAmount > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              ◎
            </div>
            <span className="text-sm font-medium">SOL</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {r.type === 'nft_airdrop' || r.type === 'nft'
          ? '1 NFT'
          : r.tokenMint && r.tokenAmount > 0
          ? formatAmount(r.tokenAmount)
          : !r.tokenMint && r.solAmount > 0
          ? `${formatAmount(r.solAmount)} SOL`
          : '—'}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {r.tokenMint && r.solAmount > 0 ? `${formatAmount(r.solAmount)} SOL` : '—'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <a
            href={`${explorer}/tx/${r.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title={r.signature}
          >
            {r.signature.slice(0, 6)}…
            <ExternalLink className="h-3 w-3" />
          </a>
          {/* T-929 #95:失败买入加重试按钮 */}
          {r.err && r.type === 'buy' && r.tokenMint && (
            <Link
              href={`/trade?mint=${r.tokenMint}&side=buy`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] text-warning hover:bg-warning/10 transition-colors"
              title={t('history.retry')}
            >
              <RotateCw className="h-3 w-3" />
              <span className="hidden md:inline">{t('history.retry')}</span>
            </Link>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

const TYPE_STYLE = {
  buy: { Icon: ArrowDownToLine, color: 'text-success' },
  sell: { Icon: ArrowUpFromLine, color: 'text-danger' },
  receive: { Icon: ArrowDownLeft, color: 'text-blue-600 dark:text-blue-400' },
  send: { Icon: ArrowUpRight, color: 'text-orange-600 dark:text-orange-400' },
  nft_airdrop: { Icon: Gift, color: 'text-purple-600 dark:text-purple-400' },
  nft: { Icon: Gift, color: 'text-purple-600 dark:text-purple-400' },
  other: { Icon: Minus, color: 'text-muted-foreground' },
} as const;

function formatTime(blockTime: number | null): string {
  if (!blockTime) return '—';
  const d = new Date(blockTime * 1000);
  const now = Date.now();
  const diffSec = (now - d.getTime()) / 1000;
  if (diffSec < 60) return `${Math.floor(diffSec)}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d`;
  return d.toLocaleDateString();
}

function formatAmount(n: number): string {
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}
