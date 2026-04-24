'use client';

/**
 * 价格提醒页主 UI:新建表单 + 列表
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PublicKey } from '@solana/web3.js';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bell, BellOff, AlertCircle, Trash2, CheckCircle2, Loader2, Shield,
} from 'lucide-react';

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
  addAlert, removeAlert, getNotifPermission, requestNotifPermission,
  type AlertDirection, type NotifPermission,
} from '@/lib/alerts';
import { fetchTokenInfo } from '@/lib/portfolio';
import { usePriceAlerts } from '@/hooks/use-price-alerts';
import { track } from '@/lib/analytics';
import { TokenPricePreview } from '@/components/common/token-price-preview';

export function AlertsView() {
  const t = useTranslations();
  const { alerts, prices, loading, refresh } = usePriceAlerts();
  const [permission, setPermission] = useState<NotifPermission>('default');

  const [mint, setMint] = useState('');
  const [direction, setDirection] = useState<AlertDirection>('above');
  const [targetUsd, setTargetUsd] = useState('');
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPermission(getNotifPermission());
  }, []);

  async function requestPermission() {
    const r = await requestNotifPermission();
    setPermission(r);
  }

  async function submit() {
    setSubmitErr(null);
    const m = mint.trim();
    if (!isValidMint(m)) {
      setSubmitErr(t('trade.errors.invalidMint'));
      return;
    }
    const target = Number(targetUsd);
    if (!target || target <= 0) {
      setSubmitErr(t('alerts.errors.invalidTarget'));
      return;
    }

    setSubmitting(true);
    try {
      const info = await fetchTokenInfo(m);
      if (!info) {
        setSubmitErr(t('alerts.errors.tokenNotFound'));
        return;
      }
      addAlert({
        mint: m,
        symbol: info.symbol,
        direction,
        targetUsd: target,
        createdPriceUsd: info.priceUsd,
      });
      track('price_alert_created', { mint: m, direction, targetUsd: target });
      setMint('');
      setTargetUsd('');
      refresh();
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    removeAlert(id);
    refresh();
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* 通知权限条幅 */}
      {permission !== 'granted' && permission !== 'unsupported' && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Bell className="h-5 w-5 text-amber-600 flex-shrink-0" />
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

      {/* 新建表单 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('alerts.form.title')}</CardTitle>
          <CardDescription>{t('alerts.form.subtitle')}</CardDescription>
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
                onValueChange={(v) => { if (v) setDirection(v as AlertDirection); }}
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
                placeholder="0.001"
                value={targetUsd}
                onChange={(e) => setTargetUsd(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">USD</div>
            </div>
          </div>

          {submitErr && (
            <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="break-all">{submitErr}</span>
            </div>
          )}

          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('common.loading')}</>
            ) : t('alerts.form.submit')}
          </Button>
        </CardContent>
      </Card>

      {/* 列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('alerts.list.title')}</h2>
          <div className="text-xs text-muted-foreground">
            {loading ? t('common.loading') : t('alerts.list.refreshHint')}
          </div>
        </div>
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t('alerts.list.empty')}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('alerts.list.token')}</TableHead>
                  <TableHead>{t('alerts.list.condition')}</TableHead>
                  <TableHead className="text-right">{t('alerts.list.current')}</TableHead>
                  <TableHead>{t('alerts.list.status')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => {
                  const cur = prices.get(a.mint);
                  return (
                    <TableRow key={a.id} className={a.triggered ? 'opacity-60' : ''}>
                      <TableCell>
                        <Link
                          href={`/token/${a.mint}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <span className="text-sm font-medium">{a.symbol}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.direction === 'above'
                          ? t('alerts.list.aboveCond', { price: a.targetUsd })
                          : t('alerts.list.belowCond', { price: a.targetUsd })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {cur != null ? `$${formatPrice(cur)}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.triggered ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('alerts.list.triggered')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Bell className="h-3 w-3" />
                            {t('alerts.list.active')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(a.id)}
                          className="h-7 px-2 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
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
