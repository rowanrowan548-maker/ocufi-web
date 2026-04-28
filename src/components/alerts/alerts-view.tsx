'use client';

/**
 * 价格提醒页(Day 11 后端版)
 */
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { PublicKey } from '@solana/web3.js';
import Link from 'next/link';
import {
  Bell, BellOff, AlertCircle, Trash2, CheckCircle2, Loader2, Wallet,
  Pause, Play, Clock, Zap, ExternalLink,
} from 'lucide-react';
import { getCurrentChain } from '@/config/chains';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  getNotifPermission, requestNotifPermission,
  type NotifPermission,
} from '@/lib/alerts';
import { fetchTokenInfo } from '@/lib/portfolio';
import {
  createAlert, deleteAlert, patchAlert, isApiConfigured,
  type CooldownMinutes, type AlertAction,
} from '@/lib/api-client';
import { usePriceAlerts } from '@/hooks/use-price-alerts';
import { track } from '@/lib/analytics';
import { TokenPricePreview } from '@/components/common/token-price-preview';
import { TgBindBanner } from './tg-bind-banner';

export function AlertsView() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { publicKey, connected } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { alerts, loading, error, refresh } = usePriceAlerts();
  const [permission, setPermission] = useState<NotifPermission>('default');

  const [mint, setMint] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [targetUsd, setTargetUsd] = useState('');
  const [cooldownMinutes, setCooldownMinutes] = useState<CooldownMinutes>(60);
  // T-957a · mode toggle 🔔 notify / ⚡ execute
  const [actionMode, setActionMode] = useState<AlertAction>('notify');
  const [amountSol, setAmountSol] = useState('');
  const [slippageBps, setSlippageBps] = useState<string>('500'); // 5% 默认
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // T-921:输入合法 mint 后拉当前价,placeholder 用 ±5% 而不是裸 0.001
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  useEffect(() => {
    const m = mint.trim();
    if (!isValidMint(m)) { setCurrentPrice(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchTokenInfo(m)
        .then((info) => { if (!cancelled) setCurrentPrice(info?.priceUsd ?? null); })
        .catch(() => { if (!cancelled) setCurrentPrice(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mint]);

  const targetPlaceholder = currentPrice && currentPrice > 0
    ? (currentPrice * (direction === 'above' ? 1.05 : 0.95)).toPrecision(4)
    : '0.001';

  useEffect(() => {
    setPermission(getNotifPermission());
  }, []);

  async function requestPermission() {
    const r = await requestNotifPermission();
    setPermission(r);
  }

  async function submit() {
    setSubmitErr(null);
    if (!publicKey) {
      openWalletModal(true);
      return;
    }
    const m = mint.trim();
    if (!isValidMint(m)) { setSubmitErr(t('trade.errors.invalidMint')); return; }
    const target = Number(targetUsd);
    if (!target || target <= 0) { setSubmitErr(t('alerts.errors.invalidTarget')); return; }

    // T-957a · execute 模式校验 amount_sol
    let amountSolNum: number | undefined;
    let slippageBpsNum: number | undefined;
    if (actionMode === 'execute') {
      amountSolNum = Number(amountSol);
      if (!amountSolNum || amountSolNum <= 0) {
        setSubmitErr(t('alerts.mode.errors.amountRequired'));
        return;
      }
      slippageBpsNum = Number(slippageBps);
      if (!Number.isFinite(slippageBpsNum) || slippageBpsNum < 10 || slippageBpsNum > 5000) {
        setSubmitErr(t('alerts.mode.errors.slippageRange'));
        return;
      }
    }

    setSubmitting(true);
    try {
      const info = await fetchTokenInfo(m);
      if (!info) {
        setSubmitErr(t('alerts.errors.tokenNotFound'));
        return;
      }
      await createAlert(publicKey.toBase58(), m, info.symbol, direction, target, {
        cooldownMinutes,
        action: actionMode,
        amountSol: amountSolNum,
        slippageBps: slippageBpsNum,
      });
      track('price_alert_created', {
        mint: m, direction, targetUsd: target, cooldownMinutes,
        action: actionMode, amountSol: amountSolNum,
      });
      setMint('');
      setTargetUsd('');
      setAmountSol('');
      refresh();
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!publicKey) return;
    try {
      await deleteAlert(publicKey.toBase58(), id);
      track('price_alert_deleted', { id });
      refresh();
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function togglePause(id: number, isActive: boolean) {
    if (!publicKey) return;
    try {
      await patchAlert(publicKey.toBase58(), id, { is_active: !isActive });
      track('price_alert_toggled', { id, paused: isActive });
      refresh();
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (!isApiConfigured()) {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('points.apiNotConfigured')}
        </CardContent>
      </Card>
    );
  }

  // T-974 BUG-037 · 未连钱包不直接挡 · 显教育态 form(mode toggle 可见 + 按钮 disabled tooltip)
  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* 未连钱包教育态 banner */}
      {(!connected || !publicKey) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-medium">{t('alerts.connectToUse')}</div>
              <div className="text-muted-foreground text-xs mt-0.5">{t('alerts.connectEducational')}</div>
            </div>
            <Button size="sm" onClick={() => openWalletModal(true)}>{t('wallet.connect')}</Button>
          </CardContent>
        </Card>
      )}
      {/* T-931b · TG 绑定状态 banner(连钱包后才显示) */}
      {connected && publicKey && <TgBindBanner />}

      {/* 通知权限条 */}
      {permission !== 'granted' && permission !== 'unsupported' && (
        <Card className="border-warning/30 bg-amber-500/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Bell className="h-5 w-5 text-warning flex-shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-medium">{t('alerts.permission.title')}</div>
              <div className="text-muted-foreground text-xs mt-0.5">
                {permission === 'denied'
                  ? t('alerts.permission.denied')
                  : t('alerts.permission.hint')}
              </div>
            </div>
            {permission === 'default' && (
              <Button size="sm" onClick={requestPermission}>
                {t('alerts.permission.enable')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {permission === 'unsupported' && (
        <Card className="border-muted">
          <CardContent className="py-4 flex items-center gap-3 text-sm text-muted-foreground">
            <BellOff className="h-5 w-5 flex-shrink-0" />
            {t('alerts.permission.unsupported')}
          </CardContent>
        </Card>
      )}

      {/* 新建 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('alerts.form.title')}</CardTitle>
          <CardDescription>{t('alerts.form.subtitleBackend')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alert-mint">{t('trade.fields.mint')}</Label>
            <Input
              id="alert-mint"
              placeholder="Token mint address"
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              className="font-mono text-sm"
            />
            <TokenPricePreview mint={mint} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="alert-dir">{t('alerts.form.direction')}</Label>
              <Select
                value={direction}
                onValueChange={(v) => { if (v) setDirection(v as 'above' | 'below'); }}
              >
                <SelectTrigger id="alert-dir">
                  {direction === 'above' ? t('alerts.form.above') : t('alerts.form.below')}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">{t('alerts.form.above')}</SelectItem>
                  <SelectItem value="below">{t('alerts.form.below')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-target">{t('alerts.form.target')}</Label>
              <Input
                id="alert-target"
                type="number"
                step="any"
                min="0"
                placeholder={targetPlaceholder}
                value={targetUsd}
                onChange={(e) => setTargetUsd(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">USD</div>
            </div>
          </div>

          {/* T-957a · 模式 toggle:🔔 notify / ⚡ execute */}
          <div className="space-y-2">
            <Label>{t('alerts.mode.label')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActionMode('notify')}
                className={`p-3 rounded-md border text-left transition-colors ${
                  actionMode === 'notify'
                    ? 'border-primary bg-primary/10'
                    : 'border-border/40 hover:border-primary/30'
                }`}
              >
                <div className="text-sm font-medium inline-flex items-center gap-1.5">
                  <Bell className={`h-3.5 w-3.5 ${actionMode === 'notify' ? 'text-primary' : ''}`} />
                  {t('alerts.mode.notify.title')}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                  {t('alerts.mode.notify.desc')}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActionMode('execute')}
                className={`p-3 rounded-md border text-left transition-colors ${
                  actionMode === 'execute'
                    ? 'border-warning bg-warning/10'
                    : 'border-border/40 hover:border-warning/30'
                }`}
              >
                <div className="text-sm font-medium inline-flex items-center gap-1.5">
                  <Zap className={`h-3.5 w-3.5 ${actionMode === 'execute' ? 'text-warning' : ''}`} />
                  {t('alerts.mode.execute.title')}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                  {t('alerts.mode.execute.desc')}
                </div>
              </button>
            </div>
          </div>

          {/* T-957a · execute 模式额外字段 */}
          {actionMode === 'execute' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-warning/5 border border-warning/20">
              <div className="space-y-2">
                <Label htmlFor="alert-amount">{t('alerts.mode.execute.amountLabel')}</Label>
                <Input
                  id="alert-amount"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.1"
                  value={amountSol}
                  onChange={(e) => setAmountSol(e.target.value)}
                />
                <div className="text-[10px] text-muted-foreground">SOL</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-slippage">{t('alerts.mode.execute.slippageLabel')}</Label>
                <Select
                  value={slippageBps}
                  onValueChange={(v) => { if (v) setSlippageBps(v); }}
                >
                  <SelectTrigger id="alert-slippage">
                    {slippageBps ? `${(Number(slippageBps) / 100).toFixed(1)}%` : '5.0%'}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">1.0%</SelectItem>
                    <SelectItem value="300">3.0%</SelectItem>
                    <SelectItem value="500">5.0%</SelectItem>
                    <SelectItem value="1000">10.0%</SelectItem>
                    <SelectItem value="2000">20.0%</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-[10px] text-muted-foreground">{t('alerts.mode.execute.slippageHint')}</div>
              </div>
            </div>
          )}

          {/* T-932b · 冷却时长 select(默认 60min) */}
          <div className="space-y-2">
            <Label htmlFor="alert-cooldown">{t('alerts.cooldown.label')}</Label>
            <Select
              value={String(cooldownMinutes)}
              onValueChange={(v) => { if (v) setCooldownMinutes(Number(v) as CooldownMinutes); }}
            >
              <SelectTrigger id="alert-cooldown">
                {t('alerts.cooldown.minutes', { n: cooldownMinutes })}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">{t('alerts.cooldown.minutes', { n: 30 })}</SelectItem>
                <SelectItem value="60">{t('alerts.cooldown.minutes', { n: 60 })}</SelectItem>
                <SelectItem value="120">{t('alerts.cooldown.minutes', { n: 120 })}</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-[11px] text-muted-foreground">{t('alerts.cooldown.hint')}</div>
          </div>

          {submitErr && (
            <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="break-all">{submitErr}</span>
            </div>
          )}

          {/* T-974 BUG-037 · 未连钱包 disabled + tooltip */}
          <Button
            onClick={() => {
              if (!connected || !publicKey) {
                openWalletModal(true);
                return;
              }
              submit();
            }}
            disabled={submitting}
            title={!connected ? t('alerts.connectFirstTip') : undefined}
            className="w-full"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('common.loading')}</>
            ) : !connected ? (
              t('alerts.connectFirst')
            ) : t('alerts.form.submit')}
          </Button>
        </CardContent>
      </Card>

      {/* 列表 · 未连钱包不显 · 没东西可列 */}
      {connected && publicKey && (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('alerts.list.title')}</h2>
          <div className="text-xs text-muted-foreground">
            {loading ? t('common.loading') : t('alerts.list.backendHint')}
          </div>
        </div>
        {error && (
          <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
        {alerts.length === 0 && !loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t('alerts.list.empty')}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('alerts.list.token')}</TableHead>
                  <TableHead>{t('alerts.list.condition')}</TableHead>
                  <TableHead className="text-right">{t('alerts.list.triggerPrice')}</TableHead>
                  <TableHead>{t('alerts.list.status')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => {
                  // T-932a/932b 字段(后端 ship 后默认有,老数据兜底)
                  const isActive = a.is_active !== false;
                  const cdMin = a.cooldown_minutes ?? 60;
                  const fireCount = a.fire_count ?? 0;
                  const cdRemainingSec = computeCooldownSec(a.last_fired_at, cdMin);
                  const inCooldown = isActive && cdRemainingSec > 0;
                  const mode: AlertAction = a.action ?? 'notify';
                  const isExecute = mode === 'execute';
                  return (
                  <TableRow key={a.id} className={!isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <Link
                        href={`/trade?mint=${a.mint}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <span className="text-sm font-medium">{a.symbol || a.mint.slice(0, 6)}</span>
                        {/* T-957a · 模式标签 🔔 / ⚡ */}
                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${
                          isExecute
                            ? 'bg-warning/15 text-warning'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {isExecute ? <Zap className="h-2.5 w-2.5" /> : <Bell className="h-2.5 w-2.5" />}
                          {isExecute ? t('alerts.mode.execute.short') : t('alerts.mode.notify.short')}
                        </span>
                      </Link>
                      {fireCount > 0 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {t('alerts.cooldown.fired', { n: fireCount })}
                        </div>
                      )}
                      {/* T-957a · execute 模式触发后显执行 tx */}
                      {a.executed_tx && (
                        <a
                          href={`${chain.explorer}/tx/${a.executed_tx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-success hover:underline mt-0.5 font-mono"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {a.executed_tx.slice(0, 6)}…
                          <ExternalLink className="h-2 w-2" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>
                        {a.direction === 'above'
                          ? t('alerts.list.aboveCond', { price: a.target_usd })
                          : t('alerts.list.belowCond', { price: a.target_usd })}
                      </div>
                      {/* T-957a · execute 模式显 amount + slippage */}
                      {isExecute && a.amount_sol != null && (
                        <div className="text-[10px] text-warning/80 mt-0.5">
                          {t('alerts.mode.execute.summary', {
                            amount: a.amount_sol,
                            slippage: ((a.slippage_bps ?? 500) / 100).toFixed(1),
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {a.triggered_price_usd != null ? `$${formatPrice(a.triggered_price_usd)}` : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {!isActive ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Pause className="h-3 w-3" />
                          {t('alerts.cooldown.paused')}
                        </span>
                      ) : inCooldown ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <Clock className="h-3 w-3" />
                          {t('alerts.cooldown.inCooldown', { n: Math.ceil(cdRemainingSec / 60) })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('alerts.cooldown.watching')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePause(a.id, isActive)}
                          title={isActive ? t('alerts.cooldown.pause') : t('alerts.cooldown.resume')}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(a.id)}
                          title={t('common.delete')}
                          className="h-7 w-7 p-0 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
      )}
    </div>
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

function formatPrice(n: number): string {
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(9);
}

// T-932b · 算冷却剩余秒,无 last_fired_at 返 0(从未触发)
function computeCooldownSec(lastFiredAt: string | null | undefined, cooldownMin: number): number {
  if (!lastFiredAt) return 0;
  const fired = Date.parse(lastFiredAt);
  if (!Number.isFinite(fired)) return 0;
  const passedSec = (Date.now() - fired) / 1000;
  const remaining = cooldownMin * 60 - passedSec;
  return remaining > 0 ? remaining : 0;
}
