'use client';

/**
 * 买入表单
 * 流程:mint + SOL → 查询报价 → 预览 → 确认弹窗 → 钱包签名 → 上链 → 成交报告
 */
import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle2, ExternalLink, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getCurrentChain } from '@/config/chains';
import {
  getQuote,
  getSwapTx,
  SOL_MINT,
  type JupiterQuote,
  type GasLevel,
} from '@/lib/jupiter';
import { resolveFee } from '@/lib/jupiter-referral';
import { signAndSend, confirmTx, analyzeTx, getDecimals } from '@/lib/trade-tx';
import { humanize } from '@/lib/friendly-error';
import { track } from '@/lib/analytics';
import { QuotePreview, formatAmount } from './quote-preview';
import { ConfirmDialog } from './confirm-dialog';

type Stage = 'idle' | 'quoting' | 'quoted' | 'signing' | 'sending' | 'confirming' | 'done' | 'error';

const SLIPPAGE_OPTIONS = [
  { value: '50', label: '0.5%' },
  { value: '100', label: '1%' },
  { value: '200', label: '2%' },
  { value: '500', label: '5%' },
];

interface QuoteData {
  quote: JupiterQuote;
  outTokens: number;
  minTokens: number;
  priceImpactPct: number;
  inputSol: number;
}

interface Result {
  signature: string;
  actualTokens: number;
  feeSol: number;
  solSpent: number;
}

export function BuyForm() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [mint, setMint] = useState('');
  const [solAmount, setSolAmount] = useState('0.1');
  const [slippageBps, setSlippageBps] = useState(100);
  const [gasLevel, setGasLevel] = useState<GasLevel>('fast');

  const [stage, setStage] = useState<Stage>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const resetOnInput = () => {
    if (stage === 'quoted' || stage === 'done' || stage === 'error') setStage('idle');
    setQuoteData(null);
    setResult(null);
    setErr(null);
  };

  async function handleQuote() {
    setErr(null);
    setResult(null);
    setQuoteData(null);

    if (!isValidMint(mint.trim())) {
      setErr(t('trade.errors.invalidMint'));
      return;
    }
    const sol = Number(solAmount);
    if (!sol || sol <= 0) {
      setErr(t('trade.errors.invalidSol'));
      return;
    }

    setStage('quoting');
    track('swap_quote_requested', { side: 'buy', mint: mint.trim(), sol });
    try {
      const amountRaw = BigInt(Math.round(sol * LAMPORTS_PER_SOL));
      const fee = resolveFee(SOL_MINT);
      const quote = await getQuote(SOL_MINT, mint.trim(), amountRaw, {
        slippageBps,
        platformFeeBps: fee.platformFeeBps,
      });
      const decimals = await getDecimals(connection, mint.trim());
      const outTokens = Number(quote.outAmount) / 10 ** decimals;
      const minTokens = Number(quote.otherAmountThreshold) / 10 ** decimals;
      const priceImpactPct = Number(quote.priceImpactPct) * 100;

      setQuoteData({ quote, outTokens, minTokens, priceImpactPct, inputSol: sol });
      setStage('quoted');
    } catch (e: unknown) {
      setErr(mapError(t, humanize(e)));
      setStage('error');
    }
  }

  function openConfirm() {
    if (!quoteData) return;
    if (!wallet.connected || !wallet.publicKey) {
      openWalletModal(true);
      return;
    }
    setConfirmOpen(true);
  }

  async function doBuy() {
    if (!quoteData || !wallet.publicKey) return;
    setErr(null);
    setConfirmOpen(false);

    try {
      setStage('signing');
      const fee = resolveFee(quoteData.quote.inputMint);
      const swap = await getSwapTx(quoteData.quote, {
        userPublicKey: wallet.publicKey.toBase58(),
        gasLevel,
        feeAccount: fee.feeAccount,
      });

      setStage('sending');
      const sig = await signAndSend(connection, wallet, swap.swapTransaction);

      setStage('confirming');
      const confirmed = await confirmTx(connection, sig, 60_000);
      if (!confirmed) {
        throw new Error(t('trade.errors.unconfirmed', { sig }));
      }

      const det = await analyzeTx(connection, sig, wallet.publicKey, mint.trim());
      const actualTokens = det?.tokenDelta ?? quoteData.outTokens;
      const feeSol = det?.feeSol ?? 0;
      const solSpent = det ? Math.abs(det.solDelta) : quoteData.inputSol;

      setResult({ signature: sig, actualTokens, feeSol, solSpent });
      setStage('done');
      track('swap_success', {
        side: 'buy',
        mint: mint.trim(),
        sol: solSpent,
        tokens: actualTokens,
        signature: sig,
      });
    } catch (e: unknown) {
      const reason = humanize(e);
      setErr(mapError(t, reason));
      setStage('error');
      track('swap_failure', { side: 'buy', mint: mint.trim(), reason });
    }
  }

  const previewData = quoteData
    ? {
        payAmount: quoteData.inputSol,
        payLabel: `${quoteData.inputSol} SOL`,
        receiveAmount: quoteData.outTokens,
        receiveLabel: formatAmount(quoteData.outTokens),
        minReceiveAmount: quoteData.minTokens,
        minReceiveLabel: formatAmount(quoteData.minTokens),
        priceImpactPct: quoteData.priceImpactPct,
      }
    : null;

  return (
    <>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{t('trade.buy.title')}</CardTitle>
          <CardDescription>{t('trade.buy.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buy-mint">{t('trade.fields.mint')}</Label>
            <Input
              id="buy-mint"
              placeholder="Token mint address"
              value={mint}
              onChange={(e) => { setMint(e.target.value); resetOnInput(); }}
              className="font-mono text-sm"
            />
            {isValidMint(mint.trim()) && (
              <Link
                href={`/token/${mint.trim()}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Shield className="h-3 w-3" />
                {t('trade.viewSafety')}
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="buy-sol">{t('trade.fields.solAmount')}</Label>
              <Input
                id="buy-sol"
                type="number"
                step="0.01"
                min="0.001"
                value={solAmount}
                onChange={(e) => { setSolAmount(e.target.value); resetOnInput(); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buy-slippage">{t('trade.fields.slippage')}</Label>
              <Select
                value={String(slippageBps)}
                onValueChange={(v) => { setSlippageBps(Number(v)); resetOnInput(); }}
              >
                <SelectTrigger id="buy-slippage">
                  {SLIPPAGE_OPTIONS.find((o) => o.value === String(slippageBps))?.label ?? '—'}
                </SelectTrigger>
                <SelectContent>
                  {SLIPPAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buy-gas">{t('trade.fields.gas')}</Label>
              <Select value={gasLevel} onValueChange={(v) => setGasLevel(v as GasLevel)}>
                <SelectTrigger id="buy-gas">{t(`trade.gas.${gasLevel}`)}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t('trade.gas.normal')}</SelectItem>
                  <SelectItem value="fast">{t('trade.gas.fast')}</SelectItem>
                  <SelectItem value="turbo">{t('trade.gas.turbo')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {err && (
            <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="break-all">{err}</span>
            </div>
          )}

          {previewData && stage !== 'done' && <QuotePreview data={previewData} />}

          {result && stage === 'done' && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-2 text-sm">
              <div className="flex gap-2 items-center text-green-600 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                {t('trade.result.success')}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('trade.result.actualReceived')}</span>
                <span className="font-mono font-medium">{formatAmount(result.actualTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('trade.result.solSpent')}</span>
                <span className="font-mono">{result.solSpent.toFixed(6)} SOL</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('trade.result.networkFee')}</span>
                <span className="font-mono">{result.feeSol.toFixed(6)} SOL</span>
              </div>
              <a
                href={`${chain.explorer}/tx/${result.signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline text-xs pt-1"
              >
                <ExternalLink className="h-3 w-3" />
                {t('trade.result.viewOnExplorer')}
              </a>
            </div>
          )}
        </CardContent>

        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleQuote}
              disabled={stage === 'quoting' || stage === 'signing' || stage === 'sending' || stage === 'confirming'}
              className="flex-1"
            >
              {stage === 'quoting' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.quoting')}</>
              ) : t('trade.buttons.quote')}
            </Button>

            {!wallet.connected ? (
              <Button onClick={() => openWalletModal(true)} className="flex-1">
                {t('wallet.connect')}
              </Button>
            ) : (
              <Button
                onClick={openConfirm}
                disabled={!quoteData || stage === 'signing' || stage === 'sending' || stage === 'confirming' || stage === 'done'}
                className="flex-1"
              >
                {stage === 'signing' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.signing')}</>}
                {stage === 'sending' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.sending')}</>}
                {stage === 'confirming' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.confirming')}</>}
                {(stage === 'idle' || stage === 'quoted' || stage === 'error') && t('trade.buttons.buy')}
                {stage === 'done' && t('trade.buttons.buyAgain')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        kind="buy"
        data={previewData}
        symbol={mint.trim() ? mint.trim().slice(0, 4) + '…' + mint.trim().slice(-4) : undefined}
        onConfirm={doBuy}
        confirming={stage === 'signing' || stage === 'sending'}
      />
    </>
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

function mapError(t: ReturnType<typeof useTranslations>, raw: string): string {
  switch (raw) {
    case '__ERR_USER_REJECTED':
      return t('trade.errors.userRejected');
    case '__ERR_SLIPPAGE':
      return t('trade.errors.slippage');
    case '__ERR_INSUFFICIENT_FUNDS':
      return t('trade.errors.insufficientFunds');
    case '__ERR_NO_ROUTE':
      return t('trade.errors.noRoute');
    case '__ERR_RPC_FORBIDDEN':
      return t('trade.errors.rpcForbidden');
    default:
      return raw;
  }
}
