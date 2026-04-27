'use client';

/**
 * 移动端"快速买入"流程
 *
 * 跳过 BuyForm 表单 UI,直接用默认参数(localStorage lastBuySolAmount /
 * recommendedSlippageBps / gas='fast') 拉一次 quote → 弹 ConfirmDialog
 * → 用户确认后走 BuyForm 的 sign / broadcast / analyze 同款流程。
 *
 * 调用方(MobileActionBar)在打开本组件前应:
 *  - 校验 risk !== 'critical'(critical 走完整 BuyForm)
 *  - 钱包未连先打开 wallet modal
 */
import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';

import { getCurrentChain } from '@/config/chains';
import {
  SOL_MINT,
  getQuote,
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
import { fetchSolUsdPrice } from '@/lib/portfolio';
import { recordFee } from '@/lib/fee-tracker';
import { ConfirmDialog } from './confirm-dialog';
import { formatAmount, type QuotePreviewData } from './quote-preview';
import type { OverallRisk, RiskReason } from '@/lib/token-info';

const DEFAULT_AMOUNT = '0.01';
const LAST_AMOUNT_KEY = 'lastBuySolAmount';
const GAS_LEVEL: GasLevel = 'fast';
const FEE_BPS = 10;

interface QuoteData {
  quote: JupiterQuote;
  outTokens: number;
  minTokens: number;
  priceImpactPct: number;
  inputSol: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mint: string;
  symbol?: string;
  risk?: OverallRisk;
  reasons?: RiskReason[];
}

export function QuickBuyConfirm({
  open,
  onOpenChange,
  mint,
  symbol,
  risk,
  reasons,
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [confirming, setConfirming] = useState(false);

  // 打开时拉 quote(并发取 decimals)
  useEffect(() => {
    if (!open) {
      setQuoteData(null);
      return;
    }
    if (!wallet.publicKey) {
      onOpenChange(false);
      return;
    }
    const stored =
      typeof window !== 'undefined' ? window.localStorage.getItem(LAST_AMOUNT_KEY) : null;
    const amountStr = stored && Number(stored) > 0 ? stored : DEFAULT_AMOUNT;
    const sol = Number(amountStr);
    if (!Number.isFinite(sol) || sol <= 0) {
      onOpenChange(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const decimals = await getDecimals(connection, mint);
        const slippageBps = recommendedSlippageBps(mint);
        const amountRaw = BigInt(Math.round(sol * LAMPORTS_PER_SOL));
        const quote = await getQuote(SOL_MINT, mint, amountRaw, { slippageBps });
        if (cancelled) return;
        setQuoteData({
          quote,
          outTokens: Number(quote.outAmount) / 10 ** decimals,
          minTokens: Number(quote.otherAmountThreshold) / 10 ** decimals,
          priceImpactPct: Number(quote.priceImpactPct) * 100,
          inputSol: sol,
        });
      } catch (e) {
        if (cancelled) return;
        toast.error(mapError(t, humanize(e)));
        onOpenChange(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mint, connection, wallet.publicKey, onOpenChange, t]);

  const networkFeeMaxSol = (() => {
    const baseLamports = 5_000;
    // gas='fast' 对应 50_000 lamports priority(buy-form 同档)
    const priorityMax = 50_000;
    return (baseLamports + priorityMax) / LAMPORTS_PER_SOL;
  })();

  const previewData: QuotePreviewData | null = quoteData
    ? {
        payAmount: quoteData.inputSol,
        payLabel: `${quoteData.inputSol} SOL`,
        receiveAmount: quoteData.outTokens,
        receiveLabel: formatAmount(quoteData.outTokens),
        minReceiveAmount: quoteData.minTokens,
        minReceiveLabel: formatAmount(quoteData.minTokens),
        priceImpactPct: quoteData.priceImpactPct,
        platformFeeSol: quoteData.inputSol * 0.001,
        networkFeeMaxSol,
      }
    : null;

  async function doBuy() {
    if (!quoteData || !wallet.publicKey) return;
    setConfirming(true);
    try {
      const tx = await buildSwapTxWithFee(
        connection,
        quoteData.quote,
        wallet.publicKey.toBase58(),
        GAS_LEVEL,
        FEE_BPS,
      );
      const sig = await signAndSendTx(connection, wallet, tx);
      const confirmed = await confirmTx(connection, sig, 60_000);
      if (!confirmed) {
        throw new Error(t('trade.errors.unconfirmed', { sig }));
      }

      const det = await analyzeTx(connection, sig, wallet.publicKey, mint);
      const actualTokens = det?.tokenDelta ?? quoteData.outTokens;
      const feeSol = det?.feeSol ?? 0;
      const solSpent = det ? Math.abs(det.solDelta) : quoteData.inputSol;

      recordFee(wallet.publicKey.toBase58(), {
        ocufiSol: quoteData.inputSol * 0.001,
        networkSol: feeSol,
        volumeSol: solSpent,
      });

      // 成功后记忆"上次买入量",下次快速买入沿用
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LAST_AMOUNT_KEY, String(quoteData.inputSol));
        }
      } catch {
        /* localStorage 满 / 隐私模式拒写 — 忽略 */
      }

      track('swap_success', {
        side: 'buy',
        mint,
        sol: solSpent,
        tokens: actualTokens,
        signature: sig,
        mode: 'quick',
      });

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
        },
      );

      if (isApiConfigured()) {
        const usdValue = await fetchSolUsdPrice()
          .then((p) => (p > 0 ? p * solSpent : undefined))
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

      onOpenChange(false);
    } catch (e: unknown) {
      const reason = humanize(e);
      const friendly = mapError(t, reason);
      track('swap_failure', { side: 'buy', mint, reason, mode: 'quick' });
      if (reason === '__ERR_USER_REJECTED') {
        toast.info(friendly);
      } else {
        toast.error(friendly, { duration: 6000 });
      }
    } finally {
      setConfirming(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      kind="buy"
      data={previewData}
      symbol={symbol}
      onConfirm={doBuy}
      confirming={confirming}
      solAmount={quoteData?.inputSol}
      risk={risk}
      reasons={reasons}
    />
  );
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
