'use client';

/**
 * 用户设置页
 * - 语言切换(通过 next-intl 路由跳转)
 * - 默认滑点自定义(覆盖 recommendedSlippageBps 的分档)
 * - 关于 / 版本 / 开源链接
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { CheckCircle2, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getCurrentChain } from '@/config/chains';
import {
  DEFAULT_SLIPPAGE, loadSettings, saveSettings, resetSettings,
  type SlippageProfile,
} from '@/lib/user-settings';
import { routing } from '@/i18n/routing';
import { isApiConfigured, pingHealth, fetchUser, setUserEmail } from '@/lib/api-client';
import { useWallet } from '@solana/wallet-adapter-react';
import { Input } from '@/components/ui/input';
import {
  useDefaultGasLevel, useSetDefaultGasLevel,
  useBuyAmounts, useSetBuyAmounts,
  useFastMode, useSetFastMode,
} from '@/lib/buy-prefs-store';
import type { GasLevel } from '@/lib/jupiter';

const SLIPPAGE_OPTIONS = [
  { value: '30', label: '0.3%' },
  { value: '50', label: '0.5%' },
  { value: '100', label: '1%' },
  { value: '200', label: '2%' },
  { value: '300', label: '3%' },
  { value: '500', label: '5%' },
  { value: '1000', label: '10%' },
];

export function SettingsView({ locale }: { locale: string }) {
  const t = useTranslations();
  const chain = getCurrentChain();
  const router = useRouter();
  const pathname = usePathname();

  const { publicKey } = useWallet();
  const [slippage, setSlippage] = useState<SlippageProfile>(DEFAULT_SLIPPAGE);
  // T-929-cont:#143 默认优先费 / #144 默认买入金额 / #146 二次确认弹窗
  const defaultGas = useDefaultGasLevel();
  const setDefaultGas = useSetDefaultGasLevel();
  const buyAmounts = useBuyAmounts();
  const setBuyAmounts = useSetBuyAmounts();
  const fastMode = useFastMode();
  const setFastMode = useSetFastMode();
  const [storeMounted, setStoreMounted] = useState(false);
  useEffect(() => setStoreMounted(true), []);
  const [saved, setSaved] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'down' | 'unconfigured'>(
    isApiConfigured() ? 'checking' : 'unconfigured'
  );
  const [email, setEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSettings();
    if (s.customSlippage) setSlippage(s.customSlippage);
  }, []);

  useEffect(() => {
    if (!isApiConfigured()) return;
    pingHealth()
      .then((r) => setApiStatus(r.status === 'ok' ? 'ok' : 'down'))
      .catch(() => setApiStatus('down'));
  }, []);

  // 从后端拉 email
  useEffect(() => {
    if (!isApiConfigured() || !publicKey) return;
    fetchUser(publicKey.toBase58())
      .then((u) => setEmail(u.email ?? ''))
      .catch(() => {});
  }, [publicKey]);

  async function handleSaveEmail() {
    if (!publicKey) return;
    setEmailErr(null);
    try {
      const r = await setUserEmail(publicKey.toBase58(), email.trim());
      if (!r.ok) {
        setEmailErr(r.error ?? 'failed');
        return;
      }
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 1500);
    } catch (e: unknown) {
      setEmailErr(e instanceof Error ? e.message : String(e));
    }
  }

  function handleSave() {
    saveSettings({ customSlippage: slippage });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleReset() {
    resetSettings();
    setSlippage(DEFAULT_SLIPPAGE);
  }

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;
    // pathname 包含 /zh-CN/... ,替换前缀
    const stripped = pathname.replace(/^\/[^/]+/, '');
    router.push(`/${newLocale}${stripped}`);
  }

  const labelFor = (bps: number) =>
    SLIPPAGE_OPTIONS.find((o) => o.value === String(bps))?.label ?? `${bps / 100}%`;

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* 语言 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language.title')}</CardTitle>
          <CardDescription>{t('settings.language.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={locale} onValueChange={(v) => { if (v) switchLocale(v); }}>
            <SelectTrigger className="max-w-xs">
              {locale === 'zh-CN' ? '简体中文' : 'English'}
            </SelectTrigger>
            <SelectContent>
              {routing.locales.map((l) => (
                <SelectItem key={l} value={l}>
                  {l === 'zh-CN' ? '简体中文' : 'English'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 默认滑点 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.slippage.title')}</CardTitle>
          <CardDescription>{t('settings.slippage.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row
            label={t('settings.slippage.stable')}
            hint={t('settings.slippage.stableHint')}
            value={slippage.stable}
            onChange={(v) => setSlippage({ ...slippage, stable: v })}
            current={labelFor(slippage.stable)}
          />
          <Row
            label={t('settings.slippage.verified')}
            hint={t('settings.slippage.verifiedHint')}
            value={slippage.verified}
            onChange={(v) => setSlippage({ ...slippage, verified: v })}
            current={labelFor(slippage.verified)}
          />
          <Row
            label={t('settings.slippage.meme')}
            hint={t('settings.slippage.memeHint')}
            value={slippage.meme}
            onChange={(v) => setSlippage({ ...slippage, meme: v })}
            current={labelFor(slippage.meme)}
          />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave}>
              {saved ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" />{t('settings.saved')}</>
              ) : t('settings.save')}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              {t('settings.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* T-929-cont #143 · 默认优先费 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.gasDefault.title')}</CardTitle>
          <CardDescription>{t('settings.gasDefault.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={storeMounted ? defaultGas : 'fast'}
            onValueChange={(v) => { if (v) setDefaultGas(v as GasLevel); }}
          >
            <SelectTrigger className="max-w-xs">
              {t(`trade.gas.${storeMounted ? defaultGas : 'fast'}`)}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">{t('trade.gas.normal')}</SelectItem>
              <SelectItem value="fast">{t('trade.gas.fast')}</SelectItem>
              <SelectItem value="turbo">{t('trade.gas.turbo')}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* T-929-cont #144 · 默认买入金额 3 档 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.buyAmounts.title')}</CardTitle>
          <CardDescription>{t('settings.buyAmounts.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {buyAmounts.map((v, i) => (
              <div key={i} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('settings.buyAmounts.preset', { n: i + 1 })}
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.001"
                    value={storeMounted ? v : ''}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n) || n <= 0) return;
                      const next = [...buyAmounts] as [number, number, number];
                      next[i] = n;
                      setBuyAmounts(next);
                    }}
                    className="font-mono text-sm"
                  />
                  <span className="text-xs text-muted-foreground">SOL</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* T-929-cont #146 · 二次确认弹窗 on/off(联动 fastMode) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.confirmDialog.title')}</CardTitle>
          <CardDescription>{t('settings.confirmDialog.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            role="switch"
            aria-checked={storeMounted ? !fastMode : true}
            onClick={() => setFastMode(!fastMode)}
            className={
              'inline-flex items-center gap-3 px-4 h-10 rounded-md border border-border/60 bg-card hover:border-primary/40 transition-colors'
            }
          >
            <span
              className={
                'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ' +
                ((storeMounted && !fastMode) ? 'bg-success' : 'bg-muted')
              }
            >
              <span
                className={
                  'inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ' +
                  ((storeMounted && !fastMode) ? 'translate-x-4' : 'translate-x-0.5')
                }
              />
            </span>
            <span className="text-sm">
              {storeMounted && !fastMode
                ? t('settings.confirmDialog.on')
                : t('settings.confirmDialog.off')}
            </span>
          </button>
        </CardContent>
      </Card>

      {/* 邮箱(Day 11 预留,不发) */}
      {isApiConfigured() && publicKey && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.email.title')}</CardTitle>
            <CardDescription>{t('settings.email.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveEmail}>
                {emailSaved ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />{t('settings.saved')}</>
                ) : t('settings.save')}
              </Button>
            </div>
            {emailErr && (
              <div className="text-xs text-destructive">{emailErr}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 关于 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.about.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <InfoRow label={t('settings.about.chain')} value={chain.name} />
          <InfoRow
            label={t('settings.about.rpc')}
            value={maskRpcUrl(chain.rpcUrl)}
            mono
          />
          <InfoRow label={t('settings.about.version')} value={BUILD_VERSION} />
          {BUILD_COMMIT && (
            <InfoRow label={t('settings.about.commit')} value={BUILD_COMMIT.slice(0, 7)} mono />
          )}
          {BUILD_TIME && (
            <InfoRow label={t('settings.about.lastUpdate')} value={formatBuildTime(BUILD_TIME)} />
          )}
          <InfoRow
            label={t('settings.about.api')}
            value={
              apiStatus === 'ok'
                ? '● ' + t('settings.about.apiOk')
                : apiStatus === 'down'
                ? '✗ ' + t('settings.about.apiDown')
                : apiStatus === 'checking'
                ? t('settings.about.apiChecking')
                : t('settings.about.apiUnconfigured')
            }
          />
          <div className="flex gap-4 pt-3 border-t">
            <a
              href="https://github.com/rowanrowan548-maker/ocufi-web"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              GitHub
            </a>
            <a
              href="https://x.com/Ocufi_io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              𝕏 @Ocufi_io
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label, hint, value, onChange, current,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (bps: number) => void;
  current: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm">{label}</Label>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Select
        value={String(value)}
        onValueChange={(v) => { if (v) onChange(Number(v)); }}
      >
        <SelectTrigger className="sm:w-32">{current}</SelectTrigger>
        <SelectContent>
          {SLIPPAGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono text-xs' : ''} break-all text-right`}>
        {value}
      </div>
    </div>
  );
}

function maskRpcUrl(url: string): string {
  try {
    const u = new URL(url);
    // 把 api-key query 抠掉避免截图泄露
    if (u.searchParams.has('api-key')) {
      u.searchParams.set('api-key', '****');
    }
    return u.toString();
  } catch {
    return url;
  }
}

// T-929-cont #148:版本号 + commit hash + build time
// Vercel 自动注入 NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA 和 NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
// next.config.ts 也镜像同名公开 env(本地开发时可裸跑无值)
const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'v0.4';
const BUILD_COMMIT = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_SHA || '';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || '';

function formatBuildTime(ts: string): string {
  if (!ts) return '—';
  // 后端注入可能是 ISO / unix · ts 兜底原文
  const d = Number.isFinite(Number(ts)) ? new Date(Number(ts)) : new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
