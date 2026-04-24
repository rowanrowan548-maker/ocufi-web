'use client';

/**
 * 买入表单
 * 流程:mint + SOL 数量 → 查询 Jupiter 报价 → 显示预览 → 确认买入 → 钱包签名 → 上链 → 成交报告
 */
import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import { Loader2, ArrowDown, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

const SLIPPAGE_OPTIONS = [
  { value: '50', label: '0.5%' },
  { value: '100', label: '1%' },
  { value: '200', label: '2%' },
  { value: '500', label: '5%' },
];
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
import { signAndSend, confirmTx, analyzeTx, getDecimals } from '@/lib/trade-tx';

type Stage = 'idle' | 'quoting' | 'quoted' | 'signing' | 'sending' | 'confirming' | 'done' | 'error';

interface QuotePreview {
  quote: JupiterQuote;
  outTokens: number;
  minTokens: number;
  priceImpactPct: number;
  inputSol: number;
  decimals: number;
}

interface TradeResult {
  signature: string;
  actualTokens: number;
  feeSol: number;
  solSpent: number;
  symbol?: string;
}

export function BuyForm() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();

  const [mint, setMint] = useState('');
  const [solAmount, setSolAmount] = useState('0.1');
  const [slippageBps, setSlippageBps] = useState(100); // 1%
  const [gasLevel, setGasLevel] = useState<GasLevel>('fast');

  const [stage, setStage] = useState<Stage>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuotePreview | null>(null);
  const [result, setResult] = useState<TradeResult | null>(null);

  const resetOnInput = () => {
    if (stage !== 'idle' && stage !== 'error') setStage('idle');
    setPreview(null);
    setResult(null);
    setErr(null);
  };

  // ───── 查询 Jupiter 报价 ─────
  async function handleQuote() {
    setErr(null);
    setResult(null);
    setPreview(null);

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
    try {
      const amountRaw = BigInt(Math.round(sol * LAMPORTS_PER_SOL));
      const quote = await getQuote(SOL_MINT, mint.trim(), amountRaw, {
        slippageBps,
        platformFeeBps: getConfiguredPlatformFeeBps(),
      });
      const decimals = await getDecimals(connection, mint.trim());
      const outTokens = Number(quote.outAmount) / 10 ** decimals;
      const minTokens = Number(quote.otherAmountThreshold) / 10 ** decimals;
      const priceImpactPct = Number(quote.priceImpactPct) * 100;

      setPreview({ quote, outTokens, minTokens, priceImpactPct, inputSol: sol, decimals });
      setStage('quoted');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage('error');
    }
  }

  // ───── 执行买入 ─────
  async function handleBuy() {
    if (!preview) return;
    if (!wallet.connected || !wallet.publicKey) {
      openWalletModal(true);
      return;
    }
    setErr(null);

    try {
      setStage('signing');
      const swap = await getSwapTx(preview.quote, {
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
      const actualTokens = det?.tokenDelta ?? preview.outTokens;
      const feeSol = det?.feeSol ?? 0;
      const solSpent = det ? Math.abs(det.solDelta) : preview.inputSol;

      setResult({
        signature: sig,
        actualTokens,
        feeSol,
        solSpent,
      });
      setStage('done');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage('error');
    }
  }

  // ───── 渲染 ─────
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{t('trade.buy.title')}</CardTitle>
        <CardDescription>{t('trade.buy.subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* mint 输入 */}
        <div className="space-y-2">
          <Label htmlFor="mint">{t('trade.fields.mint')}</Label>
          <Input
            id="mint"
            placeholder="Token mint address"
            value={mint}
            onChange={(e) => { setMint(e.target.value); resetOnInput(); }}
            className="font-mono text-sm"
          />
        </div>

        {/* SOL + 滑点 + Gas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="sol">{t('trade.fields.solAmount')}</Label>
            <Input
              id="sol"
              type="number"
              step="0.01"
              min="0.001"
              value={solAmount}
              onChange={(e) => { setSolAmount(e.target.value); resetOnInput(); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slippage">{t('trade.fields.slippage')}</Label>
            <Select
              value={String(slippageBps)}
              onValueChange={(v) => { setSlippageBps(Number(v)); resetOnInput(); }}
            >
              <SelectTrigger id="slippage">
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
            <Label htmlFor="gas">{t('trade.fields.gas')}</Label>
            <Select value={gasLevel} onValueChange={(v) => setGasLevel(v as GasLevel)}>
              <SelectTrigger id="gas">
                {t(`trade.gas.${gasLevel}`)}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{t('trade.gas.normal')}</SelectItem>
                <SelectItem value="fast">{t('trade.gas.fast')}</SelectItem>
                <SelectItem value="turbo">{t('trade.gas.turbo')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 错误提示 */}
        {err && (
          <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="break-all">{err}</span>
          </div>
        )}

        {/* 报价预览 */}
        {preview && stage !== 'done' && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('trade.preview.pay')}</span>
              <span className="font-mono font-medium">{preview.inputSol} SOL</span>
            </div>
            <div className="flex justify-center">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('trade.preview.receive')}</span>
              <span className="font-mono font-medium">{formatAmount(preview.outTokens)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
              <span>{t('trade.preview.minReceive')}</span>
              <span className="font-mono">{formatAmount(preview.minTokens)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('trade.preview.priceImpact')}</span>
              <span className={preview.priceImpactPct > 5 ? 'text-destructive font-medium' : ''}>
                {preview.priceImpactPct.toFixed(3)}%
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('trade.preview.platformFee')}</span>
              <span>
                {getConfiguredPlatformFeeBps() > 0
                  ? `${(getConfiguredPlatformFeeBps() / 100).toFixed(2)}%`
                  : t('trade.preview.platformFeeNone')}
              </span>
            </div>
          </div>
        )}

        {/* 成交结果 */}
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
              onClick={handleBuy}
              disabled={!preview || stage === 'signing' || stage === 'sending' || stage === 'confirming' || stage === 'done'}
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
  );
}

// ───── 辅助 ─────
function isValidMint(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

function formatAmount(n: number): string {
  if (!n && n !== 0) return '—';
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}
