'use client';

/**
 * 限价单表单(买入 / 卖出 共用)
 *
 * Jupiter Trigger API 规则:
 *   maker 愿意用 makingAmount 的 inputMint 换 takingAmount 的 outputMint
 *   价格 = takingAmount / makingAmount(按 decimals 换算)
 *   最小订单 $5 USD,小于会被拒
 *
 * UI:
 *   买入:用 X SOL 买 TOKEN,目标价 Y SOL/枚 → 预计买到 X/Y 枚
 *   卖出:卖 X 枚 TOKEN,目标价 Y SOL/枚 → 预计收到 X*Y SOL
 */
import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Loader2, AlertCircle, CheckCircle2, ExternalLink, Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getCurrentChain } from '@/config/chains';
import { SOL_MINT } from '@/lib/jupiter';
import { createTriggerOrder } from '@/lib/jupiter-trigger';
import { signAndSendTx, confirmTx, getDecimals } from '@/lib/trade-tx';
import { humanize } from '@/lib/friendly-error';
import { track } from '@/lib/analytics';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { TokenPricePreview } from '@/components/common/token-price-preview';

type Side = 'buy' | 'sell';
type Stage = 'idle' | 'submitting' | 'signing' | 'confirming' | 'done' | 'error';

const EXPIRY_OPTIONS = [
  { value: '86400', labelKey: 'limit.expiry.1d' },
  { value: '259200', labelKey: 'limit.expiry.3d' },
  { value: '604800', labelKey: 'limit.expiry.7d' },
  { value: '0', labelKey: 'limit.expiry.never' },
];

interface Props {
  /** 订单提交成功的回调(父组件刷新订单列表) */
  onCreated?: () => void;
}

export function LimitForm({ onCreated }: Props) {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [side, setSide] = useState<Side>('buy');
  const [mint, setMint] = useState('');
  const [amount, setAmount] = useState('');        // buy: SOL ;  sell: token 数量
  const [targetPrice, setTargetPrice] = useState(''); // SOL / 枚
  const [expirySec, setExpirySec] = useState('86400');

  const [stage, setStage] = useState<Stage>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const tokenBalance = useTokenBalance(side === 'sell' && mint.trim() ? mint.trim() : null);

  // 预览:另一侧的数量
  const amt = Number(amount);
  const price = Number(targetPrice);
  const estimated =
    amt > 0 && price > 0
      ? side === 'buy'
        ? amt / price       // 预计买到几枚
        : amt * price       // 预计收到几个 SOL
      : 0;

  const resetOnInput = () => {
    if (stage === 'done' || stage === 'error') setStage('idle');
    setSig(null);
    setErr(null);
  };

  async function submit() {
    if (!wallet.connected || !wallet.publicKey) {
      openWalletModal(true);
      return;
    }
    const m = mint.trim();
    if (!isValidMint(m)) { setErr(t('trade.errors.invalidMint')); setStage('error'); return; }
    if (!amt || amt <= 0) { setErr(t('trade.errors.invalidAmount')); setStage('error'); return; }
    if (!price || price <= 0) { setErr(t('limit.errors.invalidPrice')); setStage('error'); return; }
    if (side === 'sell' && tokenBalance.amount != null && amt > tokenBalance.amount * 1.0001) {
      setErr(t('trade.errors.insufficientToken')); setStage('error'); return;
    }

    setErr(null);
    setSig(null);
    setStage('submitting');
    track('limit_order_requested', { side, mint: m, amount: amt, price });

    try {
      const decimals = await getDecimals(connection, m);

      let inputMint: string;
      let outputMint: string;
      let makingAmount: string;
      let takingAmount: string;
      if (side === 'buy') {
        inputMint = SOL_MINT;
        outputMint = m;
        makingAmount = BigInt(Math.round(amt * LAMPORTS_PER_SOL)).toString();
        const wantTokens = amt / price;
        takingAmount = BigInt(Math.round(wantTokens * 10 ** decimals)).toString();
      } else {
        inputMint = m;
        outputMint = SOL_MINT;
        makingAmount = BigInt(Math.round(amt * 10 ** decimals)).toString();
        const wantSol = amt * price;
        takingAmount = BigInt(Math.round(wantSol * LAMPORTS_PER_SOL)).toString();
      }

      const userPk = wallet.publicKey.toBase58();
      const expiredAt =
        expirySec === '0' ? undefined : String(Math.floor(Date.now() / 1000) + Number(expirySec));

      const order = await createTriggerOrder({
        inputMint,
        outputMint,
        maker: userPk,
        payer: userPk,
        makingAmount,
        takingAmount,
        expiredAt,
      });

      setStage('signing');
      const tx = VersionedTransaction.deserialize(
        Buffer.from(order.transaction, 'base64')
      );
      const sigStr = await signAndSendTx(connection, wallet, tx);

      setStage('confirming');
      const confirmed = await confirmTx(connection, sigStr, 60_000);
      if (!confirmed) throw new Error(t('trade.errors.unconfirmed', { sig: sigStr }));

      setSig(sigStr);
      setStage('done');
      track('limit_order_created', { side, mint: m, signature: sigStr });
      onCreated?.();
    } catch (e: unknown) {
      const reason = humanize(e);
      setErr(mapError(t, reason));
      setStage('error');
      track('limit_order_failed', { side, mint: m, reason });
    }
  }

  const amountLabel = side === 'buy' ? t('limit.amountBuy') : t('limit.amountSell');
  const estimatedLabel =
    side === 'buy' ? t('limit.estimatedBuy') : t('limit.estimatedSell');
  const busy = stage === 'submitting' || stage === 'signing' || stage === 'confirming';

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{t('limit.title')}</CardTitle>
        <CardDescription>{t('limit.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={side} onValueChange={(v) => { setSide(v as Side); resetOnInput(); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">{t('trade.tabs.buy')}</TabsTrigger>
            <TabsTrigger value="sell">{t('trade.tabs.sell')}</TabsTrigger>
          </TabsList>

          <TabsContent value={side} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="limit-mint">{t('trade.fields.mint')}</Label>
              <Input
                id="limit-mint"
                placeholder="Token mint address"
                value={mint}
                onChange={(e) => { setMint(e.target.value); resetOnInput(); }}
                className="font-mono text-sm"
              />
              <TokenPricePreview mint={mint} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="limit-amount">{amountLabel}</Label>
                <Input
                  id="limit-amount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={side === 'buy' ? '0.1' : '0'}
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); resetOnInput(); }}
                />
                {side === 'sell' && tokenBalance.amount != null && (
                  <div className="text-xs text-muted-foreground">
                    {t('trade.sell.yourBalance')}: {tokenBalance.amount.toFixed(4)}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit-price">{t('limit.targetPrice')}</Label>
                <Input
                  id="limit-price"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00001"
                  value={targetPrice}
                  onChange={(e) => { setTargetPrice(e.target.value); resetOnInput(); }}
                />
                <div className="text-xs text-muted-foreground">{t('limit.priceUnit')}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit-expiry">{t('limit.expiry.label')}</Label>
              <Select
                value={expirySec}
                onValueChange={(v) => {
                  if (v) {
                    setExpirySec(v);
                    resetOnInput();
                  }
                }}
              >
                <SelectTrigger id="limit-expiry">
                  {t(EXPIRY_OPTIONS.find((o) => o.value === expirySec)?.labelKey ?? 'limit.expiry.1d')}
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {estimated > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">{estimatedLabel}</span>
                <span className="font-mono font-medium">
                  {formatAmount(estimated)} {side === 'buy' ? '枚' : 'SOL'}
                </span>
              </div>
            )}

            {err && (
              <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="break-all">{err}</span>
              </div>
            )}

            {sig && stage === 'done' && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('limit.success')}
                </div>
                <a
                  href={`${chain.explorer}/tx/${sig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline text-xs"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('trade.result.viewOnExplorer')}
                </a>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardContent className="pt-0">
        {!wallet.connected ? (
          <Button onClick={() => openWalletModal(true)} className="w-full">
            {t('wallet.connect')}
          </Button>
        ) : (
          <Button onClick={submit} disabled={busy} className="w-full">
            {stage === 'submitting' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('limit.submitting')}</>}
            {stage === 'signing' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.signing')}</>}
            {stage === 'confirming' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.confirming')}</>}
            {!busy && (side === 'buy' ? t('limit.placeBuy') : t('limit.placeSell'))}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

function formatAmount(n: number): string {
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}

function mapError(t: ReturnType<typeof useTranslations>, raw: string): string {
  switch (raw) {
    case '__ERR_USER_REJECTED': return t('trade.errors.userRejected');
    case '__ERR_INSUFFICIENT_FUNDS': return t('trade.errors.insufficientFunds');
    case '__ERR_RPC_FORBIDDEN': return t('trade.errors.rpcForbidden');
    default: return raw;
  }
}
