'use client';

/**
 * T-931b · /alerts 顶部 Telegram 绑定 banner + 三步绑定 Dialog
 *
 * - 未绑:橙色 banner 引导
 * - 已绑:绿色 banner 显示 @username
 * - 绑定状态:走后端 GET /alerts/tg-binding?wallet=X
 *   失败兜底 localStorage 标记 + 60s polling 探测后端是否上线
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { Send, Copy, Check, X, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchTgBinding, type TgBindingStatus } from '@/lib/api-client';

const TG_BOT_USERNAME = 'Ocufi_bot';
const POLL_MS = 60_000;

const LS_KEY_PREFIX = 'ocufi.tgBindingHint.';

function readLocalHint(wallet: string): boolean {
  try {
    return window.localStorage.getItem(LS_KEY_PREFIX + wallet) === '1';
  } catch {
    return false;
  }
}

function writeLocalHint(wallet: string, bound: boolean): void {
  try {
    if (bound) window.localStorage.setItem(LS_KEY_PREFIX + wallet, '1');
    else window.localStorage.removeItem(LS_KEY_PREFIX + wallet);
  } catch {
    /* localStorage 满 / 隐私模式拒写 */
  }
}

export function TgBindBanner() {
  const t = useTranslations('alerts.tgBind');
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [status, setStatus] = useState<TgBindingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) { setStatus(null); return; }
    setLoading(true);
    try {
      const s = await fetchTgBinding(wallet);
      setStatus(s);
      writeLocalHint(wallet, !!s.bound);
    } catch {
      // 后端 404 / 503 兜底:localStorage 标记 → 至少不丢失"用户已成功绑定"提示
      const hinted = readLocalHint(wallet);
      setStatus({ bound: hinted });
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    refresh();
    if (!wallet) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [wallet, refresh]);

  if (!wallet) return null;

  const bound = !!status?.bound;
  const username = status?.tg_username ?? null;

  return (
    <>
      <div
        className={
          'rounded-md border p-3 sm:p-4 flex items-center gap-3 ' +
          (bound
            ? 'border-success/30 bg-success/10'
            : 'border-warning/30 bg-warning/10')
        }
      >
        <Send
          className={
            'h-4 w-4 flex-shrink-0 ' + (bound ? 'text-success' : 'text-warning')
          }
        />
        <div className="flex-1 min-w-0">
          <div
            className={
              'text-sm font-medium ' + (bound ? 'text-success' : 'text-warning')
            }
          >
            {bound ? t('boundTitle') : t('unboundTitle')}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {bound
              ? username
                ? t('boundDesc', { username })
                : t('boundUnknown')
              : t('unboundDesc')}
          </div>
        </div>
        {!bound && (
          <Button size="sm" onClick={() => setDialogOpen(true)} className="flex-shrink-0">
            {t('unboundCta')}
          </Button>
        )}
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60 flex-shrink-0" />}
      </div>

      {dialogOpen && (
        <BindDialog
          wallet={wallet}
          onClose={() => {
            setDialogOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
}

function BindDialog({ wallet, onClose }: { wallet: string; onClose: () => void }) {
  const t = useTranslations('alerts.tgBind.dialog');
  const cmd = `/start ${wallet}`;
  const [copied, setCopied] = useState(false);

  // 锁滚 + ESC 关
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 拒 */
    }
  }

  function openTg() {
    // tg://resolve 桌面 / 移动 TG app 通用,fallback https://t.me/<bot>?start=<payload>
    const deep = `tg://resolve?domain=${TG_BOT_USERNAME}&start=${encodeURIComponent(wallet)}`;
    const httpsUrl = `https://t.me/${TG_BOT_USERNAME}?start=${encodeURIComponent(wallet)}`;
    // 先尝试 deep link,200ms 内若 still on page 跳 https
    const startedAt = Date.now();
    window.location.href = deep;
    setTimeout(() => {
      if (Date.now() - startedAt < 1500 && document.visibilityState === 'visible') {
        window.open(httpsUrl, '_blank', 'noopener,noreferrer');
      }
    }, 800);
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-background/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-base font-semibold">{t('title')}</div>
            <div className="text-xs text-muted-foreground mt-1">{t('desc')}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="h-8 w-8 -mr-1 -mt-1 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="space-y-3 text-sm">
          <li className="text-muted-foreground">{t('step1')}</li>
          <li>
            <div className="text-muted-foreground mb-1.5">{t('step2')}</div>
            <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
              <code className="flex-1 font-mono text-xs truncate text-foreground">{cmd}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-success" />
                    {t('copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    {t('copyCmd')}
                  </>
                )}
              </button>
            </div>
          </li>
          <li className="text-muted-foreground">{t('step3')}</li>
        </ol>

        <Button onClick={openTg} className="w-full" size="lg">
          <ExternalLink className="h-4 w-4 mr-2" />
          {t('openTg')}
        </Button>
      </div>
    </div>
  );
}
