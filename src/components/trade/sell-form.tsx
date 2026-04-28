'use client';

/**
 * 卖出表单
 * 流程:粘 mint → 读持仓余额 → 输数量 / 点快捷 % 按钮 → 查报价 → 确认弹窗 → 签名 → 成交回报
 */
import { useEffect, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTranslations, useLocale } from 'next-intl';
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
import { showBadgeToasts } from '@/lib/badge-toast';
import { fetchSolUsdPrice } from '@/lib/portfolio';
import { QuotePreview, formatAmount } from './quote-preview';
import { ConfirmDialog } from './confirm-dialog';
import { GasSelect } from './gas-select';
import { pushTradeNotification } from '@/lib/notification-store';
import { TokenPricePreview } from '@/components/common/token-price-preview';
import { useAutoQuote } from '@/hooks/use-auto-quote';
import { RefreshRing } from '@/components/common/refresh-ring';
import { TradeProgressOverlay } from './trade-progress-overlay';
import { recordFee } from '@/lib/fee-tracker';
import { ShareTradeButton } from '@/components/share/share-trade-button';
import { toast } from 'sonner';
import type { OverallRisk, RiskReason } from '@/lib/token-info';
import { rawGreaterOrEqualToOne, rawToUiFixed, rawToUiNumber } from '@/lib/raw-amount';

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
  /** 上层算好的风险等级:high / critical / unknown 时弹"我知晓"勾选 */
  risk?: OverallRisk;
  /** 具体风险原因列表(由上层 riskReasons() 算出),展示在确认弹窗里 */
  reasons?: RiskReason[];
}

export function SellForm({ mint: mintProp, compact, risk, reasons }: SellFormProps = {}) {
  const t = useTranslations();
  const locale = useLocale();
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

  // T-205 N2:quoteData.tokenAmount 改用 quote.inAmount(raw)经 BigInt 切位转 number,
  // 比 Number(tokenAmount) 多一道 BigInt 处理,边界更稳(analytics / toast 显示偏差更小)
  const quoteData: QuoteData | null =
    autoQuote.status === 'ok' && balance.decimals != null
      ? {
          quote: autoQuote.quote,
          tokenAmount: rawToUiNumber(autoQuote.quote.inAmount, balance.decimals),
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
      // T-204 N1:大 raw(meme decimals=6 余额 > 90 亿 / SPL decimals=9 > 900 万)
      // 走 BigInt → 字符串 切位,不走 Number(raw)/10^dec 浮点损失路径
      const dp = rawGreaterOrEqualToOne(balance.rawAmount, balance.decimals) ? 4 : 9;
      setTokenAmount(rawToUiFixed(balance.rawAmount, balance.decimals, dp));
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

      // T-942 #56 · 持久化卖出留痕
      pushTradeNotification({
        side: 'sell',
        mint: mint.trim(),
        symbol: mint.trim().slice(0, 4) + '…' + mint.trim().slice(-4),
        amountSol: actualSol,
        amountTokens: quoteData.tokenAmount,
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
        const usdValue = await fetchSolUsdPrice()
          .then((p) => p > 0 ? p * actualSol : undefined)
          .catch(() => undefined);
        claimPoints(wallet.publicKey.toBase58(), sig, usdValue)
          .then((res) => {
            if (res.newBadges?.length) {
              showBadgeToasts({
                badges: res.newBadges,
                locale,
                unlockedTitle: t('badges.toast.unlocked'),
                goBadgesLabel: t('badges.toast.viewAll'),
              });
            }
          })
          .catch(() => {});
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

          {/* BUG-036:数量全宽,滑点 + Gas 横排 50/50(桌面 + 移动一致) */}
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
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
                {/* T-965 #168 · 滑点 > 10% 时红色警告 */}
                {slippageBps > 1000 && (
                  <div className="text-[10px] text-danger flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {t('trade.fields.slippageWarn', { pct: (slippageBps / 100).toFixed(0) })}
                  </div>
                )}
              </div>
              <GasSelect id="sell-gas" value={gasLevel} onChange={setGasLevel} />
            </div>
          </div>

          {/* 错误 */}
          {err && (
            <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="break-all">{err}</span>
            </div>
          )}

          {/* 报价预览 · BUG-037:有报价显示 QuotePreview,无报价显示引导卡 */}
          {previewData && stage !== 'done' ? (
            <QuotePreview
              data={previewData}
              currentSlippageBps={slippageBps}
              onApplySlippage={(bps) => {
                setSlippageBps(bps);
                slippageTouched.current = true;
                resetOnInput();
              }}
            />
          ) : stage !== 'done' && stage !== 'error' && (
            <div className="rounded-lg border border-dashed bg-muted/10 p-4 text-xs text-muted-foreground/70 text-center">
              {t('trade.preview.placeholderSell')}
            </div>
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
            <Button onClick={() => openWalletModal(true)} className="w-full h-14 sm:h-11 text-base sm:text-sm font-semibold" size="lg">
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
              className="w-full h-14 sm:h-11 text-base sm:text-sm font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
        risk={risk}
        reasons={reasons}
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
    case '__ERR_BLOCKHASH_EXPIRED':
      return t('trade.errors.blockhashExpired');
    case '__ERR_TX_SIMULATION_FAIL':
      return t('trade.errors.txSimulationFail');
    case '__ERR_TX_SIZE_OVERFLOW':
      return t('trade.errors.txSizeOverflow');
    case '__ERR_BALANCE_DRIFT':
      return t('trade.errors.balanceDrift');
    default:
      return raw;
  }
}
