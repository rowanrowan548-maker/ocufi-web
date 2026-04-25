'use client';

/**
 * 卖出表单
 * 流程:粘 mint → 读持仓余额 → 输数量 / 点快捷 % 按钮 → 查报价 → 确认弹窗 → 签名 → 成交回报
 */
import { useEffect, useRef, useState } from 'react';
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
  SOL_MINT,
  type JupiterQuote,
  type GasLevel,
} from '@/lib/jupiter';
import { recommendedSlippageBps } from '@/lib/verified-tokens';
import { buildSwapTxWithFee } from '@/lib/swap-with-fee';
import { signAndSendTx, confirmTx, analyzeTx } from '@/lib/trade-tx';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { humanize } from '@/lib/friendly-error';
import { track } from '@/lib/analytics';
import { claimPoints, isApiConfigured } from '@/lib/api-client';
import { QuotePreview, formatAmount } from './quote-preview';
import { ConfirmDialog } from './confirm-dialog';
import { TokenPricePreview } from '@/components/common/token-price-preview';
import { useAutoQuote } from '@/hooks/use-auto-quote';
import { RefreshRing } from '@/components/common/refresh-ring';
import { TradeProgressOverlay } from './trade-progress-overlay';
import { recordFee } from '@/lib/fee-tracker';
import { ShareTradeButton } from '@/components/share/share-trade-button';
import { toast } from 'sonner';
import type { OverallRisk } from '@/lib/token-info';

type Stage = 'idle' | 'quoting' | 'quoted' | 'signing' | 'sending' | 'confirming' | 'done' | 'error';

const SLIPPAGE_OPTIONS = [
  { value: '50', label: '0.5%' },
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

interface SellFormProps {
  mint?: string;
  compact?: boolean;
  /** 上层算好的风险等级:high / critical 时弹"我知晓"勾选 */
  risk?: OverallRisk;
}

export function SellForm({ mint: mintProp, compact, risk }: SellFormProps = {}) {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [mint, setMint] = useState(mintProp ?? '');
  const [tokenAmount, setTokenAmount] = useState('');
  // 100% 卖空时记下精确 raw amount,quote/swap 用它而非 ui×10^dec
  const [fullSellRaw, setFullSellRaw] = useState<string | null>(null);

  useEffect(() => {
    if (mintProp != null) setMint(mintProp);
  }, [mintProp]);
  const [slippageBps, setSlippageBps] = useState(500); // meme 默认 5%,合法 mint 输入后会按推荐值自动调
  const [gasLevel, setGasLevel] = useState<GasLevel>('fast');
  const slippageTouched = useRef(false);

  // 合法 mint 输入后,按 token 类型应用推荐滑点(稳定币/蓝筹/meme 分档)
  useEffect(() => {
    const m = mint.trim();
    if (slippageTouched.current) return;
    if (!isValidMint(m)) return;
    setSlippageBps(recommendedSlippageBps(m));
  }, [mint]);

  const [stage, setStage] = useState<Stage>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progressSig, setProgressSig] = useState<string | undefined>(undefined);
  const [progressStartedAt, setProgressStartedAt] = useState<number | undefined>(undefined);

  const balance = useTokenBalance(mint.trim() || null);

  // ── 自动报价 ──
  const amt = Number(tokenAmount);
  const validInput =
    isValidMint(mint.trim()) &&
    amt > 0 &&
    balance.decimals != null &&
    (balance.amount == null || amt <= balance.amount * 1.0001);
  // 100% 用 chain raw,其他用 ui × 10^dec
  const amountRaw = validInput
    ? fullSellRaw
      ? BigInt(fullSellRaw)
      : BigInt(Math.floor(amt * 10 ** (balance.decimals ?? 0)))
    : null;
  const autoQuote = useAutoQuote({
    enabled: validInput && stage !== 'done' && stage !== 'signing' && stage !== 'sending' && stage !== 'confirming',
    inputMint: mint.trim(),
    outputMint: SOL_MINT,
    amountRaw,
    options: { slippageBps },
  });

  const quoteData: QuoteData | null =
    autoQuote.status === 'ok'
      ? {
          quote: autoQuote.quote,
          tokenAmount: amt,
          outSol: Number(autoQuote.quote.outAmount) / LAMPORTS_PER_SOL,
          minSol: Number(autoQuote.quote.otherAmountThreshold) / LAMPORTS_PER_SOL,
          priceImpactPct: Number(autoQuote.quote.priceImpactPct) * 100,
        }
      : null;

  const resetOnInput = () => {
    if (stage === 'done' || stage === 'error') setStage('idle');
    setResult(null);
    setErr(null);
  };

  // 百分比快捷
  // 100% 全仓卖:**直接传链上 raw amount**,quote/swap 用 BigInt 精确,
  // 不走 ui × 10^decimals 的浮点路径(浮点会有 1-2 lamport 偏差,触发 insufficient balance)
  function setPct(pct: number) {
    if (balance.amount == null || balance.decimals == null) return;
    if (pct === 100 && balance.rawAmount) {
      const n = Number(balance.rawAmount) / 10 ** balance.decimals;
      setTokenAmount(n >= 1 ? n.toFixed(4) : n.toFixed(9));
      setFullSellRaw(balance.rawAmount);
    } else {
      const n = (balance.amount * pct) / 100;
      setTokenAmount(n >= 1 ? n.toFixed(4) : n.toFixed(9));
      setFullSellRaw(null);
    }
    resetOnInput();
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
    setProgressSig(undefined);
    setProgressStartedAt(Date.now());

    try {
      setStage('signing');
      // 卖出走相同 /swap-instructions 路径,feeBps=0(内部会跳过 fee ix)
      const tx = await buildSwapTxWithFee(
        connection,
        quoteData.quote,
        wallet.publicKey.toBase58(),
        gasLevel,
        0
      );

      setStage('sending');
      const sig = await signAndSendTx(connection, wallet, tx);
      setProgressSig(sig);

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

      // 卖出 V1 不收 Ocufi fee,只记网络 Gas;体量按 outputSol(收到的 SOL)
      if (wallet.publicKey) {
        recordFee(wallet.publicKey.toBase58(), {
          ocufiSol: 0,
          networkSol: feeSol,
          volumeSol: actualSol,
        });
      }

      track('swap_success', {
        side: 'sell',
        mint: mint.trim(),
        sol: actualSol,
        tokens: quoteData.tokenAmount,
        signature: sig,
      });

      toast.success(
        t('trade.toast.sellSuccess', {
          sol: actualSol.toFixed(4),
          tokens: formatAmount(quoteData.tokenAmount),
        }),
        {
          action: {
            label: t('trade.toast.viewExplorer'),
            onClick: () => window.open(`${chain.explorer}/tx/${sig}`, '_blank'),
          },
          duration: 8000,
        }
      );

      if (isApiConfigured() && wallet.publicKey) {
        claimPoints(wallet.publicKey.toBase58(), sig).catch(() => {});
      }
    } catch (e: unknown) {
      const reason = humanize(e);
      const friendly = mapError(t, reason);
      setErr(friendly);
      setStage('error');
      track('swap_failure', { side: 'sell', mint: mint.trim(), reason });

      if (reason === '__ERR_USER_REJECTED') {
        toast.info(friendly);
      } else {
        toast.error(friendly, { duration: 6000 });
      }
    }
  }

  // Solana 网络 Gas 上限(SOL):base 5000 lamports + priority fee maxLamports
  const networkFeeMaxSol = (() => {
    const baseLamports = 5_000;
    const priorityMax =
      gasLevel === 'normal' ? 5_000 : gasLevel === 'fast' ? 50_000 : 1_000_000;
    return (baseLamports + priorityMax) / LAMPORTS_PER_SOL;
  })();

  const previewData = quoteData
    ? {
        payAmount: quoteData.tokenAmount,
        payLabel: formatAmount(quoteData.tokenAmount),
        receiveAmount: quoteData.outSol,
        receiveLabel: `${quoteData.outSol.toFixed(6)} SOL`,
        minReceiveAmount: quoteData.minSol,
        minReceiveLabel: `${quoteData.minSol.toFixed(6)} SOL`,
        priceImpactPct: quoteData.priceImpactPct,
        // V1 卖出不收 Ocufi fee
        platformFeeSol: 0,
        networkFeeMaxSol,
      }
    : null;

  return (
    <>
      <Card className={compact ? 'w-full' : 'w-full max-w-xl'}>
        {!compact && (
          <CardHeader>
            <CardTitle>{t('trade.sell.title')}</CardTitle>
            <CardDescription>{t('trade.sell.subtitle')}</CardDescription>
          </CardHeader>
        )}

        <CardContent className="space-y-4">
          {mintProp == null && (
            <div className="space-y-2">
              <Label htmlFor="sell-mint">{t('trade.fields.mint')}</Label>
              <Input
                id="sell-mint"
                placeholder="Token mint address"
                value={mint}
                onChange={(e) => { setMint(e.target.value); resetOnInput(); }}
                className="font-mono text-sm"
              />
              <TokenPricePreview mint={mint} />
            </div>
          )}

          {/* 余额显示(无论受控与否,只要 mint 合法+连了钱包就显示) */}
          <div className="space-y-2">
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
                onChange={(e) => { setTokenAmount(e.target.value); setFullSellRaw(null); resetOnInput(); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-slippage">{t('trade.fields.slippage')}</Label>
              <Select
                value={String(slippageBps)}
                onValueChange={(v) => {
                  setSlippageBps(Number(v));
                  slippageTouched.current = true;
                  resetOnInput();
                }}
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
                  {(['normal', 'fast', 'turbo'] as GasLevel[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      <div className="flex flex-col items-start">
                        <span className="text-sm">{t(`trade.gas.${g}`)}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {t(`trade.gas.${g}Desc`)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
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
          {previewData && stage !== 'done' && (
            <QuotePreview
              data={previewData}
              currentSlippageBps={slippageBps}
              onApplySlippage={(bps) => {
                setSlippageBps(bps);
                slippageTouched.current = true;
                resetOnInput();
              }}
            />
          )}

          {/* 成交结果 */}
          {result && stage === 'done' && (
            <div className="rounded-lg border border-success/30 bg-green-500/5 p-4 space-y-2 text-sm">
              <div className="flex gap-2 items-center text-success font-medium">
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
              <div className="flex items-center justify-between pt-1">
                <a
                  href={`${chain.explorer}/tx/${result.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline text-xs"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('trade.result.viewOnExplorer')}
                </a>
                <ShareTradeButton
                  mint={mint.trim()}
                  kind="sell"
                  amount={quoteData?.tokenAmount ?? 0}
                  solAmount={result.actualSol}
                />
              </div>
            </div>
          )}
        </CardContent>

        <CardContent className="pt-0">
          {validInput && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <span>
                {autoQuote.status === 'loading' && t('trade.quoteStatus.loading')}
                {autoQuote.status === 'ok' && t('trade.quoteStatus.live')}
                {autoQuote.status === 'error' && (
                  <span className="text-danger">{t('trade.quoteStatus.error')}</span>
                )}
                {autoQuote.status === 'idle' && '—'}
              </span>
              {autoQuote.status === 'ok' && (
                <RefreshRing remaining={autoQuote.refreshIn} total={8} size={20} />
              )}
              {autoQuote.status === 'loading' && (
                <RefreshRing remaining={0} total={8} size={20} loading />
              )}
            </div>
          )}

          {!wallet.connected ? (
            <Button onClick={() => openWalletModal(true)} className="w-full" size="lg">
              {t('wallet.connect')}
            </Button>
          ) : (
            <Button
              onClick={openConfirm}
              size="lg"
              disabled={
                !quoteData ||
                stage === 'signing' ||
                stage === 'sending' ||
                stage === 'confirming' ||
                stage === 'done'
              }
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {stage === 'signing' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.signing')}</>}
              {stage === 'sending' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.sending')}</>}
              {stage === 'confirming' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.confirming')}</>}
              {(stage === 'idle' || stage === 'error') && t('trade.buttons.sell')}
              {stage === 'done' && t('trade.buttons.sellAgain')}
            </Button>
          )}
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
        solAmount={quoteData?.outSol}
        highRisk={risk === 'high' || risk === 'critical'}
      />

      <TradeProgressOverlay
        open={stage === 'signing' || stage === 'sending' || stage === 'confirming'}
        stage={stage}
        signature={progressSig}
        explorer={chain.explorer}
        startedAt={progressStartedAt}
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
