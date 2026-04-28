'use client';

/**
 * T-PF-86 · portfolio 导出按钮
 *
 * 点击展开 dropdown:CSV / Token Tax 两种格式
 * 客户端 generate · 不打后端 · download as .csv
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { Download, FileText, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTxHistory } from '@/hooks/use-tx-history';
import {
  buildHistoryCsv,
  buildTokenTaxCsv,
  downloadCsv,
} from '@/lib/export-csv';

export function ExportButton() {
  const t = useTranslations('portfolio.export');
  const { publicKey } = useWallet();
  const { records } = useTxHistory(500);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside);
      document.addEventListener('keydown', onEsc);
    }
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  function handleExport(kind: 'csv' | 'tax') {
    if (!publicKey || records.length === 0) return;
    const wallet = publicKey.toBase58();
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'csv') {
      const content = buildHistoryCsv(records);
      downloadCsv(`ocufi-history-${wallet.slice(0, 4)}-${stamp}.csv`, content);
    } else {
      const content = buildTokenTaxCsv(records);
      downloadCsv(`ocufi-tax-${wallet.slice(0, 4)}-${stamp}.csv`, content);
    }
    setOpen(false);
  }

  const disabled = !publicKey || records.length === 0;

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2 gap-1.5 text-xs"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('button')}</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-56 rounded-md border border-border/40 bg-popover shadow-md ring-1 ring-foreground/10 p-1">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="w-full flex items-start gap-2 px-2 py-2 rounded text-left hover:bg-accent/50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/70 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium">{t('csv.title')}</div>
              <div className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">
                {t('csv.desc')}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleExport('tax')}
            className="w-full flex items-start gap-2 px-2 py-2 rounded text-left hover:bg-accent/50 transition-colors"
          >
            <Receipt className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/70 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium">{t('tax.title')}</div>
              <div className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">
                {t('tax.desc')}
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
