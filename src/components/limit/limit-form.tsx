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
import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { useTranslations, useLocale } from 'next-intl';
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
import { claimPoints, isApiConfigured } from '@/lib/api-client';
import { showBadgeToasts } from '@/lib/badge-toast';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { TokenPricePreview } from '@/components/common/token-price-preview';
import { fetchTokenInfo, fetchSolUsdPrice, type TokenInfo } from '@/lib/portfolio';
import { LimitPreview, LimitPreviewPlaceholder } from './limit-preview';

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
  /** 受控 side(由外层 trade-tabs 提供时,隐藏自己的 buy/sell tabs) */
  side?: Side;
  /** 受控 mint(外层提供时隐藏 mint 输入) */
  mint?: string;
  /** 紧凑模式:去 max-w-xl,无 hero header */
  compact?: boolean;
}

export function LimitForm({ onCreated, side: sideProp, mint: mintProp, compact }: Props = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [side, setSide] = useState<Side>(sideProp ?? 'buy');
  const [mint, setMint] = useState(mintProp ?? '');

  // 受控同步
  useEffect(() => {
    if (sideProp != null) setSide(sideProp);
  }, [sideProp]);
  useEffect(() => {
    if (mintProp != null) setMint(mintProp);
  }, [mintProp]);
  const [amount, setAmount] = useState('');        // buy: SOL ;  sell: token 数量
  const [targetPrice, setTargetPrice] = useState(''); // SOL / 枚
  const [expirySec, setExpirySec] = useState('86400');

  const [stage, setStage] = useState<Stage>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const tokenBalance = useTokenBalance(side === 'sell' && mint.trim() ? mint.trim() : null);

  // BUG-037:拉 token 市价 + SOL/USD 价 · 给 LimitPreview 算价格差 + $5 USD 阈值
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [solUsdPrice, setSolUsdPrice] = useState<number | null>(null);
  useEffect(() => {
    const m = mint.trim();
    if (!isValidMint(m)) {
      setTokenInfo(null);
      return;
    }
    let cancelled = false;
    fetchTokenInfo(m)
      .then((i) => { if (!cancelled) setTokenInfo(i); })
      .catch(() => { if (!cancelled) setTokenInfo(null); });
    return () => { cancelled = true; };
  }, [mint]);
  useEffect(() => {
    let cancelled = false;
    fetchSolUsdPrice()
      .then((p) => { if (!cancelled) setSolUsdPrice(p); })
      .catch(() => { /* 失败时 USD 估值不显示,不阻塞预览 */ });
    return () => { cancelled = true; };
  }, []);

  // 预览:另一侧的数量
  const amt = Number(amount);
  const price = Number(targetPrice);
  const estimated =
    amt > 0 && price > 0
      ? side === 'buy'
        ? amt / price       // 预计买到几枚
        : amt * price       // 预计收到几个 SOL
      : 0;

  // 订单 USD 估值:买 = SOL 数 × SOL/USD;卖 = token 数 × 当前 SOL 价 × SOL/USD
  const orderUsdValue =
    solUsdPrice != null && amt > 0
      ? side === 'buy'
        ? amt * solUsdPrice
        : tokenInfo?.priceNative != null
          ? amt * tokenInfo.priceNative * solUsdPrice
          : null
      : null;

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
      if (isApiConfigured() && wallet.publicKey) {
        claimPoints(wallet.publicKey.toBase58(), sigStr)
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
      onCreated?.();
    } catch (e: unknown) {
      const reason = humanize(e);
      setErr(mapError(t, reason));
      setStage('error');
      track('limit_order_failed', { side, mint: m, reason });
    }
  }

  const amountLabel = side === 'buy' ? t('limit.amountBuy') : t('limit.amountSell');
  const busy = stage === 'submitting' || stage === 'signing' || stage === 'confirming';

  const showSideTabs = sideProp == null;
  const showMintInput = mintProp == null;

  // 抽出表单核心内容(让两种模式 — 内置 tabs / 受控 — 共用)
  const formBody = (
    <>
      {showMintInput && (
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
      )}

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

      {/* BUG-037:统一限价单预览卡 · 与 QuotePreview 视觉一致 */}
      {amt > 0 && price > 0 ? (
        <LimitPreview
          side={side}
          symbol={tokenInfo?.symbol ?? ''}
          amount={amt}
          targetPrice={price}
          estimated={estimated}
          marketPrice={tokenInfo?.priceNative ?? null}
          orderUsdValue={orderUsdValue}
        />
      ) : (
        <LimitPreviewPlaceholder />
      )}

      {err && (
        <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-all">{err}</span>
        </div>
      )}

      {sig && stage === 'done' && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1 text-sm">
          <div className="flex items-center gap-2 text-success font-medium">
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
    </>
  );

  // 紧凑模式:只输出表单内容(外层 trade-tabs 提供 Card + Tabs)
  if (compact) {
    return <div className="space-y-4">{formBody}</div>;
  }

  // 独立模式:Card + Header + Tabs(原 /limit 页用)
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{t('limit.title')}</CardTitle>
        <CardDescription>{t('limit.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showSideTabs ? (
          <Tabs value={side} onValueChange={(v) => { setSide(v as Side); resetOnInput(); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy">{t('trade.tabs.buy')}</TabsTrigger>
              <TabsTrigger value="sell">{t('trade.tabs.sell')}</TabsTrigger>
            </TabsList>
            <TabsContent value={side} className="space-y-4 mt-4">
              {formBody}
            </TabsContent>
          </Tabs>
        ) : (
          formBody
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

function mapError(t: ReturnType<typeof useTranslations>, raw: string): string {
  switch (raw) {
    case '__ERR_USER_REJECTED': return t('trade.errors.userRejected');
    case '__ERR_INSUFFICIENT_FUNDS': return t('trade.errors.insufficientFunds');
    case '__ERR_RPC_FORBIDDEN': return t('trade.errors.rpcForbidden');
    case '__ERR_BLOCKHASH_EXPIRED': return t('trade.errors.blockhashExpired');
    case '__ERR_BALANCE_DRIFT': return t('trade.errors.balanceDrift');
    case '__ERR_TX_SIMULATION_FAIL': return t('trade.errors.txSimulationFail');
    case '__ERR_TX_SIZE_OVERFLOW': return t('trade.errors.txSizeOverflow');
    default: return raw;
  }
}
