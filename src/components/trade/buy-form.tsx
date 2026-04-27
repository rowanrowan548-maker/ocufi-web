'use client';

/**
 * 买入表单
 * 流程:mint + SOL → 查询报价 → 预览 → 确认弹窗 → 钱包签名 → 上链 → 成交报告
 */
import { useEffect, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTranslations, useLocale } from 'next-intl';
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
  SOL_MINT,
  type JupiterQuote,
  type GasLevel,
} from '@/lib/jupiter';
import { recommendedSlippageBps } from '@/lib/verified-tokens';
import { buildSwapTxWithFee } from '@/lib/swap-with-fee';
import { signAndSendTx, confirmTx, analyzeTx, getDecimals } from '@/lib/trade-tx';
import { humanize } from '@/lib/friendly-error';
import { track } from '@/lib/analytics';
import { claimPoints, isApiConfigured } from '@/lib/api-client';
import { showBadgeToasts } from '@/lib/badge-toast';
import { fetchSolUsdPrice, fetchTokenInfo, type TokenInfo } from '@/lib/portfolio';
import { shouldSkipBuyConfirm } from '@/lib/buy-prefs-store';
import { QuotePreview, formatAmount } from './quote-preview';
import { ConfirmDialog } from './confirm-dialog';
import { GasSelect } from './gas-select';
import { TokenPricePreview } from '@/components/common/token-price-preview';
import { useAutoQuote } from '@/hooks/use-auto-quote';
import { RefreshRing } from '@/components/common/refresh-ring';
import { TradeProgressOverlay } from './trade-progress-overlay';
import { recordFee } from '@/lib/fee-tracker';
import { ShareTradeButton } from '@/components/share/share-trade-button';
import { toast } from 'sonner';
import type { OverallRisk, RiskReason } from '@/lib/token-info';

// SOL 余额安全保留(rent + 优先费 buffer)
const SOL_RESERVE = 0.01;

type Stage = 'idle' | 'quoting' | 'quoted' | 'signing' | 'sending' | 'confirming' | 'done' | 'error';

const SLIPPAGE_OPTIONS = [
  { value: '50', label: '0.5%' },
  { value: '100', label: '1%' },
  { value: '200', label: '2%' },
  { value: '500', label: '5%' },
  { value: '1000', label: '10%' },
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

interface BuyFormProps {
  /** 受控 mint:上层(如 trade-screen)传入则隐藏内部 mint 输入框 */
  mint?: string;
  /** 紧凑模式:去掉 max-width,把 form 撑满父容器 */
  compact?: boolean;
  /** 上层算好的风险等级:high / critical / unknown 时弹"我知晓"勾选 */
  risk?: OverallRisk;
  /** 具体风险原因列表(由上层 riskReasons() 算出),展示在确认弹窗里 */
  reasons?: RiskReason[];
}

export function BuyForm({ mint: mintProp, compact, risk, reasons }: BuyFormProps = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [mint, setMint] = useState(mintProp ?? '');
  const [solAmount, setSolAmount] = useState('0.1');

  // 受控:外部 mint 变化同步进来
  useEffect(() => {
    if (mintProp != null) setMint(mintProp);
  }, [mintProp]);

  // 支持 ?mint=X 从首页代币行情表 / 任意链接预填(client only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = new URLSearchParams(window.location.search).get('mint');
    if (m && m.length >= 32) setMint(m);
  }, []);
  const [slippageBps, setSlippageBps] = useState(100);
  const [gasLevel, setGasLevel] = useState<GasLevel>('fast');
  // 用户是否手动调过滑点:调过就别用推荐值覆盖
  const slippageTouched = useRef(false);

  // 输入合法 mint 时按 token 类型应用推荐滑点(稳定币/蓝筹/meme 分档)
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
  const [decimals, setDecimals] = useState<number | null>(null);
  const [progressSig, setProgressSig] = useState<string | undefined>(undefined);
  const [progressStartedAt, setProgressStartedAt] = useState<number | undefined>(undefined);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  // T-925:目标代币元数据(给 ConfirmDialog 头部 + QuotePreview 当前价 / 估值用)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  useEffect(() => {
    const m = mint.trim();
    if (!isValidMint(m)) { setTokenInfo(null); return; }
    let cancelled = false;
    fetchTokenInfo(m)
      .then((info) => { if (!cancelled) setTokenInfo(info); })
      .catch(() => { if (!cancelled) setTokenInfo(null); });
    return () => { cancelled = true; };
  }, [mint]);

  // SOL 余额(用于 MAX 按钮);连钱包 + stage 切换时刷
  useEffect(() => {
    if (!wallet.publicKey) {
      setSolBalance(null);
      return;
    }
    let cancelled = false;
    connection
      .getBalance(wallet.publicKey)
      .then((lamports) => {
        if (!cancelled) setSolBalance(lamports / LAMPORTS_PER_SOL);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [wallet.publicKey, connection, stage]);

  // 拉目标 token 的 decimals(供 outAmount 解析)
  useEffect(() => {
    const m = mint.trim();
    if (!isValidMint(m)) {
      setDecimals(null);
      return;
    }
    let cancelled = false;
    getDecimals(connection, m).then((d) => {
      if (!cancelled) setDecimals(d);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [mint, connection]);

  // ── 自动报价 hook ──
  const sol = Number(solAmount);
  const validInput = isValidMint(mint.trim()) && sol > 0;
  const amountRaw = validInput ? BigInt(Math.round(sol * LAMPORTS_PER_SOL)) : null;
  const autoQuote = useAutoQuote({
    enabled: validInput && stage !== 'done' && stage !== 'signing' && stage !== 'sending' && stage !== 'confirming',
    inputMint: SOL_MINT,
    outputMint: mint.trim(),
    amountRaw,
    options: { slippageBps },
  });

  // 派生 quoteData(给 QuotePreview / ConfirmDialog 用)
  const quoteData: QuoteData | null =
    autoQuote.status === 'ok' && decimals != null
      ? {
          quote: autoQuote.quote,
          outTokens: Number(autoQuote.quote.outAmount) / 10 ** decimals,
          minTokens: Number(autoQuote.quote.otherAmountThreshold) / 10 ** decimals,
          priceImpactPct: Number(autoQuote.quote.priceImpactPct) * 100,
          inputSol: sol,
        }
      : null;

  const resetOnInput = () => {
    if (stage === 'done' || stage === 'error') setStage('idle');
    setResult(null);
    setErr(null);
  };

  // T-925 #52:honeypot / blacklist hard-block 代码 → 买入按钮禁用
  // 不放 ack-then-pass 路径,因为 ack 兜底无法保护蜜罐(签名后即损失)
  const BLOCK_CODES = ['nonTransferable', 'maliciousCreator', 'balanceMutable', 'highTransferFee'];
  const blockedReasons = (reasons ?? []).filter((r) => BLOCK_CODES.includes(r.code));
  const isBlocked = blockedReasons.length > 0;
  const ackRequired = risk === 'high' || risk === 'critical' || risk === 'unknown';

  function openConfirm() {
    if (!quoteData) return;
    if (!wallet.connected || !wallet.publicKey) {
      openWalletModal(true);
      return;
    }
    // T-925 #45:快速模式 / 24h skip → 直接走 doBuy
    // 不在 ackRequired 风险下走快速路径(老手也不该裸跑高危)
    if (!ackRequired && shouldSkipBuyConfirm()) {
      void doBuy();
      return;
    }
    setConfirmOpen(true);
  }

  async function doBuy() {
    if (!quoteData || !wallet.publicKey) return;
    setErr(null);
    setConfirmOpen(false);
    setProgressSig(undefined);
    setProgressStartedAt(Date.now());

    try {
      setStage('signing');
      // 自组 tx:在 Jupiter swap 前插一条 SystemProgram.transfer 收 0.1% SOL fee
      // vault 地址来自 NEXT_PUBLIC_OCUFI_FEE_VAULT env;未配则不插 fee
      const tx = await buildSwapTxWithFee(
        connection,
        quoteData.quote,
        wallet.publicKey.toBase58(),
        gasLevel,
        10
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
      const actualTokens = det?.tokenDelta ?? quoteData.outTokens;
      const feeSol = det?.feeSol ?? 0;
      const solSpent = det ? Math.abs(det.solDelta) : quoteData.inputSol;

      setResult({ signature: sig, actualTokens, feeSol, solSpent });
      setStage('done');

      // 累计手续费(本地)· Ocufi 0.1% × 输入 SOL,网络 Gas 来自实际 tx 解析,体量 = inputSol
      if (wallet.publicKey) {
        recordFee(wallet.publicKey.toBase58(), {
          ocufiSol: quoteData.inputSol * 0.001,
          networkSol: feeSol,
          volumeSol: solSpent,
        });
      }

      // 记忆"上次买入量"给移动端快速买入(T-505b)沿用
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('lastBuySolAmount', String(quoteData.inputSol));
        }
      } catch { /* localStorage 满 / 隐私模式拒写 */ }

      track('swap_success', {
        side: 'buy',
        mint: mint.trim(),
        sol: solSpent,
        tokens: actualTokens,
        signature: sig,
      });

      // 成功 toast · 含 Solscan 链接
      toast.success(
        t('trade.toast.buySuccess', {
          tokens: formatAmount(actualTokens),
          sol: solSpent.toFixed(4),
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
        // 算 USD 估值用于邀请激活判定(单笔 ≥ $100 激活)
        // 用最近的 SOL 价 × inputSol;失败就不传(后端不激活,但仍记积分)
        const usdValue = await fetchSolUsdPrice()
          .then((p) => p > 0 ? p * solSpent : undefined)
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
      track('swap_failure', { side: 'buy', mint: mint.trim(), reason });

      // 失败 toast · 用 sentinel 区分
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
        payAmount: quoteData.inputSol,
        payLabel: `${quoteData.inputSol} SOL`,
        receiveAmount: quoteData.outTokens,
        receiveLabel: formatAmount(quoteData.outTokens),
        minReceiveAmount: quoteData.minTokens,
        minReceiveLabel: formatAmount(quoteData.minTokens),
        priceImpactPct: quoteData.priceImpactPct,
        // 买入收 0.1% SOL fee
        platformFeeSol: quoteData.inputSol * 0.001,
        networkFeeMaxSol,
        // T-925 #47:当前现货价 + 成交后估值
        currentPriceUsd: tokenInfo?.priceUsd,
        postTradeValueUsd: tokenInfo?.priceUsd
          ? tokenInfo.priceUsd * quoteData.outTokens
          : undefined,
      }
    : null;

  return (
    <>
      <Card className={compact ? 'w-full' : 'w-full max-w-xl'}>
        {!compact && (
          <CardHeader>
            <CardTitle>{t('trade.buy.title')}</CardTitle>
            <CardDescription>{t('trade.buy.subtitle')}</CardDescription>
          </CardHeader>
        )}

        <CardContent className="space-y-4">
          {/* 受控时(trade-screen 顶部已有搜索)隐藏自己的 mint 输入 */}
          {mintProp == null && (
            <div className="space-y-2">
              <Label htmlFor="buy-mint">{t('trade.fields.mint')}</Label>
              <Input
                id="buy-mint"
                placeholder="Token mint address"
                value={mint}
                onChange={(e) => { setMint(e.target.value); resetOnInput(); }}
                className="font-mono text-sm"
              />
              <TokenPricePreview mint={mint} />
            </div>
          )}

          {/* BUG-036:SOL 数量全宽,滑点 + 优先级 横排 50/50(桌面 + 移动一致) */}
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="buy-slippage">{t('trade.fields.slippage')}</Label>
                <Select
                  value={String(slippageBps)}
                  onValueChange={(v) => {
                    setSlippageBps(Number(v));
                    slippageTouched.current = true;
                    resetOnInput();
                  }}
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
              <GasSelect id="buy-gas" value={gasLevel} onChange={setGasLevel} />
            </div>
          </div>

          {/* 快捷金额 · 0.1 / 0.5 / 1 / MAX */}
          {wallet.connected && (
            <div className="flex gap-2 flex-wrap">
              {[0.1, 0.5, 1].map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setSolAmount(String(v)); resetOnInput(); }}
                  className="text-xs px-3"
                >
                  {v} SOL
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={solBalance == null || solBalance <= SOL_RESERVE}
                onClick={() => {
                  if (solBalance == null) return;
                  const max = Math.max(0, solBalance - SOL_RESERVE);
                  setSolAmount(max.toFixed(4));
                  resetOnInput();
                }}
                className="text-xs px-3"
              >
                {t('trade.quickAmount.max')}
                {solBalance != null && (
                  <span className="ml-1 text-muted-foreground/70 font-mono">
                    {Math.max(0, solBalance - SOL_RESERVE).toFixed(2)}
                  </span>
                )}
              </Button>
            </div>
          )}

          {err && (
            <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="break-all">{err}</span>
            </div>
          )}

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
            // BUG-037:默认空 amount 时显示引导卡,告知用户报价就在这里
            <div className="rounded-lg border border-dashed bg-muted/10 p-4 text-xs text-muted-foreground/70 text-center">
              {t('trade.preview.placeholderBuy')}
            </div>
          )}

          {result && stage === 'done' && (
            <div className="rounded-lg border border-success/30 bg-green-500/5 p-4 space-y-2 text-sm">
              <div className="flex gap-2 items-center text-success font-medium">
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
                  kind="buy"
                  amount={result.actualTokens}
                  solAmount={result.solSpent}
                />
              </div>
            </div>
          )}
        </CardContent>

        <CardContent className="pt-0">
          {/* 报价状态指示 */}
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
                <RefreshRing
                  remaining={autoQuote.refreshIn}
                  total={8}
                  size={20}
                />
              )}
              {autoQuote.status === 'loading' && (
                <RefreshRing remaining={0} total={8} size={20} loading />
              )}
            </div>
          )}

          {/* T-925 #52:命中 honeypot/blacklist hard-block 信号 → 红色提示 + 禁用买入 */}
          {isBlocked && (
            <div className="rounded-md border border-danger/60 bg-danger/15 p-3 text-xs space-y-1.5">
              <div className="flex items-start gap-2 text-danger font-medium">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>{t('trade.confirm.blocked')}</div>
              </div>
              <div className="text-muted-foreground pl-6">{t('trade.confirm.blockedHint')}</div>
              <ul className="pl-6 space-y-0.5 list-disc list-inside marker:text-danger/60">
                {blockedReasons.map((r) => (
                  <li key={r.code} className="text-foreground">
                    {t(`trade.confirm.highRisk.reasons.${r.code}`)}
                  </li>
                ))}
              </ul>
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
                isBlocked ||
                !quoteData ||
                stage === 'signing' ||
                stage === 'sending' ||
                stage === 'confirming' ||
                stage === 'done'
              }
              className="w-full"
            >
              {stage === 'signing' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.signing')}</>}
              {stage === 'sending' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.sending')}</>}
              {stage === 'confirming' && <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('trade.buttons.confirming')}</>}
              {(stage === 'idle' || stage === 'error') && t('trade.buttons.buy')}
              {stage === 'done' && t('trade.buttons.buyAgain')}
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        kind="buy"
        data={previewData}
        symbol={tokenInfo?.symbol ?? (mint.trim() ? mint.trim().slice(0, 4) + '…' + mint.trim().slice(-4) : undefined)}
        tokenName={tokenInfo?.name}
        tokenLogoUri={tokenInfo?.logoUri}
        mintAddr={mint.trim() || undefined}
        onConfirm={doBuy}
        confirming={stage === 'signing' || stage === 'sending'}
        solAmount={quoteData?.inputSol}
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
    case '__ERR_BALANCE_DRIFT':
      return t('trade.errors.balanceDrift');
    case '__ERR_TX_SIMULATION_FAIL':
      return t('trade.errors.txSimulationFail');
    case '__ERR_TX_SIZE_OVERFLOW':
      return t('trade.errors.txSizeOverflow');
    default:
      return raw;
  }
}
