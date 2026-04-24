'use client';

/**
 * 卖出表单
 * 流程:粘 mint → 读持仓余额 → 输数量 / 点快捷 % 按钮 → 查报价 → 确认弹窗 → 签名 → 成交回报
 */
import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, CheckCircle2, ExternalLink, Wallet } from 'lucide-react';

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
  getConfiguredFeeAccount,
  getConfiguredPlatformFeeBps,
  type JupiterQuote,
  type GasLevel,
} from '@/lib/jupiter';
import { signAndSend, confirmTx, analyzeTx } from '@/lib/trade-tx';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { humanize } from '@/lib/friendly-error';
import { QuotePreview, formatAmount } from './quote-preview';
import { ConfirmDialog } from './confirm-dialog';

type Stage = 'idle' | 'quoting' | 'quoted' | 'signing' | 'sending' | 'confirming' | 'done' | 'error';

const SLIPPAGE_OPTIONS = [
  { value: '100', label: '1%' },
  { value: '200', label: '2%' },
  { value: '500', label: '5%' },
  { value: '1000', label: '10%' },
];

const PCT_BUTTONS = [25, 50, 100];

interface QuoteData {
  quote: JupiterQuote;
  tokenAmount: number;
  outSol: number;
  minSol: number;
  priceImpactPct: number;
}

interface Result {
  signature: string;
  actualSol: number;
  feeSol: number;
}

export function SellForm() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [mint, setMint] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(200); // 1000 个 pump 土狗,2% 更合理
  const [gasLevel, setGasLevel] = useState<GasLevel>('fast');

  const [stage, setStage] = useState<Stage>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const balance = useTokenBalance(mint.trim() || null);

  const resetOnInput = () => {
    if (stage === 'quoted' || stage === 'done' || stage === 'error') setStage('idle');
    setQuoteData(null);
    setResult(null);
    setErr(null);
  };

  // 百分比快捷
  function setPct(pct: number) {
    if (balance.amount == null) return;
    const n = (balance.amount * pct) / 100;
    // 限制有效位数,避免科学计数
    setTokenAmount(n >= 1 ? n.toFixed(4) : n.toFixed(9));
    resetOnInput();
  }

  async function handleQuote() {
    setErr(null);
    setResult(null);
    setQuoteData(null);

    if (!isValidMint(mint.trim())) {
      setErr(t('trade.errors.invalidMint'));
      return;
    }
    const amt = Number(tokenAmount);
    if (!amt || amt <= 0) {
      setErr(t('trade.errors.invalidAmount'));
      return;
    }
    if (balance.decimals == null) {
      setErr(t('trade.errors.balanceUnknown'));
      return;
    }
    if (balance.amount != null && amt > balance.amount * 1.0001) {
      setErr(t('trade.errors.insufficientToken'));
      return;
    }

    setStage('quoting');
    try {
      const amountRaw = BigInt(Math.floor(amt * 10 ** balance.decimals));
      const quote = await getQuote(mint.trim(), SOL_MINT, amountRaw, {
        slippageBps,
        platformFeeBps: getConfiguredPlatformFeeBps(),
      });
      const outSol = Number(quote.outAmount) / LAMPORTS_PER_SOL;
      const minSol = Number(quote.otherAmountThreshold) / LAMPORTS_PER_SOL;
      const priceImpactPct = Number(quote.priceImpactPct) * 100;

      setQuoteData({ quote, tokenAmount: amt, outSol, minSol, priceImpactPct });
      setStage('quoted');
    } catch (e: unknown) {
      setErr(mapError(t, humanize(e)));
      setStage('error');
    }
  }

  // 点"卖出"先弹确认
  function openConfirm() {
    if (!quoteData) return;
    if (!wallet.connected || !wallet.publicKey) {
      openWalletModal(true);
      return;
    }
    setConfirmOpen(true);
  }

  async function doSell() {
    if (!quoteData || !wallet.publicKey) return;
    setErr(null);
    setConfirmOpen(false);

    try {
      setStage('signing');
      const swap = await getSwapTx(quoteData.quote, {
        userPublicKey: wallet.publicKey.toBase58(),
        gasLevel,
        feeAccount: getConfiguredFeeAccount(),
      });

      setStage('sending');
      const sig = await signAndSend(connection, wallet, swap.swapTransaction);

      setStage('confirming');
      const confirmed = await confirmTx(connection, sig, 60_000);
      if (!confirmed) {
        throw new Error(t('trade.errors.unconfirmed', { sig }));
      }

      const det = await analyzeTx(connection, sig, wallet.publicKey, mint.trim());
      const feeSol = det?.feeSol ?? 0;
      const actualSol = det ? det.solDelta + feeSol : quoteData.outSol; // solDelta 已扣 fee

      setResult({ signature: sig, actualSol, feeSol });
      setStage('done');
    } catch (e: unknown) {
      setErr(mapError(t, humanize(e)));
      setStage('error');
    }
  }

  const previewData = quoteData
    ? {
        payAmount: quoteData.tokenAmount,
        payLabel: formatAmount(quoteData.tokenAmount),
        receiveAmount: quoteData.outSol,
        receiveLabel: `${quoteData.outSol.toFixed(6)} SOL`,
        minReceiveAmount: quoteData.minSol,
        minReceiveLabel: `${quoteData.minSol.toFixed(6)} SOL`,
        priceImpactPct: quoteData.priceImpactPct,
      }
    : null;

  return (
    <>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{t('trade.sell.title')}</CardTitle>
          <CardDescription>{t('trade.sell.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* mint */}
          <div className="space-y-2">
            <Label htmlFor="sell-mint">{t('trade.fields.mint')}</Label>
            <Input
              id="sell-mint"
              placeholder="Token mint address"
              value={mint}
              onChange={(e) => { setMint(e.target.value); resetOnInput(); }}
              className="font-mono text-sm"
            />
            {/* 余额显示 */}
            {wallet.connected && mint.trim() && isValidMint(mint.trim()) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Wallet className="h-3 w-3" />
                <span>{t('trade.sell.yourBalance')}:</span>
                {balance.loading && balance.amount == null ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : balance.amount != null ? (
                  <span className="font-mono font-medium text-foreground">
                    {formatAmount(balance.amount)}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            )}
          </div>

          {/* 快捷百分比 */}
          {balance.amount != null && balance.amount > 0 && (
            <div className="flex gap-2 flex-wrap">
              {PCT_BUTTONS.map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPct(pct)}
                  className="text-xs px-3"
                >
                  {pct}%
                </Button>
              ))}
            </div>
          )}

          {/* 数量 + 滑点 + Gas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sell-amount">{t('trade.sell.amount')}</Label>
              <Input
                id="sell-amount"
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={tokenAmount}
                onChange={(e) => { setTokenAmount(e.target.value); resetOnInput(); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-slippage">{t('trade.fields.slippage')}</Label>
              <Select
                value={String(slippageBps)}
                onValueChange={(v) => { setSlippageBps(Number(v)); resetOnInput(); }}
              >
                <SelectTrigger id="sell-slippage">
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
              <Label htmlFor="sell-gas">{t('trade.fields.gas')}</Label>
              <Select value={gasLevel} onValueChange={(v) => setGasLevel(v as GasLevel)}>
                <SelectTrigger id="sell-gas">{t(`trade.gas.${gasLevel}`)}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t('trade.gas.normal')}</SelectItem>
                  <SelectItem value="fast">{t('trade.gas.fast')}</SelectItem>
                  <SelectItem value="turbo">{t('trade.gas.turbo')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 错误 */}
          {err && (
            <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="break-all">{err}</span>
            </div>
          )}

          {/* 报价预览 */}
          {previewData && stage !== 'done' && <QuotePreview data={previewData} />}

          {/* 成交结果 */}
          {result && stage === 'done' && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-2 text-sm">
              <div className="flex gap-2 items-center text-green-600 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                {t('trade.result.success')}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('trade.sell.receivedSol')}</span>
                <span className="font-mono font-medium">{result.actualSol.toFixed(6)} SOL</span>
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
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {stage === 'signing' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.signing')}</>}
                {stage === 'sending' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.sending')}</>}
                {stage === 'confirming' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.confirming')}</>}
                {(stage === 'idle' || stage === 'quoted' || stage === 'error') && t('trade.buttons.sell')}
                {stage === 'done' && t('trade.buttons.sellAgain')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        kind="sell"
        data={previewData}
        symbol={mint.trim() ? mint.trim().slice(0, 4) + '…' + mint.trim().slice(-4) : undefined}
        onConfirm={doSell}
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
