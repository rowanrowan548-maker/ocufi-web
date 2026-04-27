'use client';

/**
 * T-908a · 设置齿轮菜单(桌面 dropdown / 移动 inline)
 *
 * - 主题(浅 / 暗 / 自动)next-themes
 * - 语言(zh-CN / en-US)next-intl 路由切换
 * - 货币(USD / SOL · 仅占位 localStorage,T-908b 接全站)
 * - 钱包断开(connected 时显示)
 * - 关于 Ocufi 链接
 */
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Settings, Sun, Moon, Monitor, LogOut, Info, Globe, DollarSign,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { routing } from '@/i18n/routing';
import { useCurrency, useSetCurrency, type Currency } from '@/lib/currency-store';

interface Props {
  /** inline 模式:不渲染 dropdown 包装,直接展开内容(给 mobile drawer 用) */
  inline?: boolean;
}

export function SettingsMenu({ inline }: Props) {
  const t = useTranslations();
  const wallet = useWallet();
  const router = useRouter();

  if (inline) {
    return (
      <div className="space-y-3">
        <SettingsBody />
        <div className="pt-2 mt-2 border-t border-border/30 space-y-1">
          {wallet.connected && (
            <button
              type="button"
              onClick={() => {
                wallet.disconnect().catch(() => {});
              }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-danger hover:bg-danger/5"
            >
              <LogOut className="h-4 w-4" />
              {t('settings.walletDisconnect')}
            </button>
          )}
          <Link
            href="/"
            className="w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40"
          >
            <Info className="h-4 w-4" />
            {t('settings.aboutLink')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 w-9 p-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none"
        title={t('settings.title')}
        aria-label={t('settings.title')}
      >
        <Settings className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <div className="px-1.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
          {t('settings.title')}
        </div>
        <div className="px-1 pb-2">
          <SettingsBody />
        </div>
        <DropdownMenuSeparator className="my-1" />
        {wallet.connected && (
          <DropdownMenuItem
            onClick={() => {
              wallet.disconnect().catch(() => {});
            }}
            className="cursor-pointer text-danger focus:text-danger"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('settings.walletDisconnect')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => router.push('/')}
          className="cursor-pointer"
        >
          <Info className="h-4 w-4 mr-2" />
          {t('settings.aboutLink')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SettingsBody() {
  return (
    <div className="space-y-3">
      <ThemeRow />
      <LanguageRow />
      <CurrencyRow />
    </div>
  );
}

function ThemeRow() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value = mounted ? theme ?? 'system' : 'dark';

  const opts: { v: 'light' | 'dark' | 'system'; Icon: typeof Sun; label: string }[] = [
    { v: 'light', Icon: Sun, label: t('settings.themeLight') },
    { v: 'dark', Icon: Moon, label: t('settings.themeDark') },
    { v: 'system', Icon: Monitor, label: t('settings.themeAuto') },
  ];

  return (
    <SettingRow icon={Sun} label={t('settings.theme')}>
      <Segmented
        options={opts.map((o) => ({ value: o.v, label: o.label, Icon: o.Icon }))}
        value={value}
        onChange={(v) => setTheme(v)}
      />
    </SettingRow>
  );
}

function LanguageRow() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;
    const stripped = pathname.replace(/^\/[^/]+/, '');
    router.push(`/${newLocale}${stripped}`);
  }

  return (
    <SettingRow icon={Globe} label={t('settings.language.title')}>
      <Segmented
        options={routing.locales.map((l) => ({
          value: l,
          label: l === 'zh-CN' ? '中' : 'EN',
          srLabel: l === 'zh-CN' ? '简体中文' : 'English',
        }))}
        value={locale}
        onChange={(v) => switchLocale(v)}
      />
    </SettingRow>
  );
}

function CurrencyRow() {
  const t = useTranslations();
  const currency = useCurrency();
  const setCurrency = useSetCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <SettingRow icon={DollarSign} label={t('settings.currency')}>
      <Segmented
        options={[
          { value: 'USD', label: 'USD' },
          { value: 'SOL', label: 'SOL' },
        ]}
        value={mounted ? currency : 'USD'}
        onChange={(v) => setCurrency(v as Currency)}
      />
    </SettingRow>
  );
}

function SettingRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Sun;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      {children}
    </div>
  );
}

interface SegOpt<T extends string> {
  value: T;
  label: string;
  srLabel?: string;
  Icon?: typeof Sun;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegOpt<T>[];
  value: string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md bg-muted/40 p-0.5 gap-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-label={o.srLabel ?? o.label}
            className={
              'inline-flex items-center justify-center gap-1 px-2 h-6 rounded text-[11px] font-medium transition-colors ' +
              (active
                ? 'bg-success/15 text-success'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {o.Icon && <o.Icon className="h-3 w-3" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
