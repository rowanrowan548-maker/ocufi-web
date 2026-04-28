/**
 * T-PF-86 · 客户端生成 CSV(标准 + Token Tax 简版)
 *
 * 完全本地计算 · 不打后端 · download via Blob URL
 */
import type { EnrichedTxRecord } from '@/hooks/use-tx-history';

const SOL = 'SOL';

function csvEscape(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isoDate(blockTime: number | null): string {
  if (!blockTime) return '';
  return new Date(blockTime * 1000).toISOString();
}

function tokenIdent(r: EnrichedTxRecord): string {
  return r.tokenSymbol || r.tokenMint || '';
}

/**
 * 标准 CSV 列:
 * date / type / token_in / amount_in / token_out / amount_out / fee_sol / tx_sig
 */
export function buildHistoryCsv(records: EnrichedTxRecord[]): string {
  const headers = [
    'date', 'type', 'token_in', 'amount_in',
    'token_out', 'amount_out', 'fee_sol', 'tx_sig',
  ];
  const lines: string[] = [headers.join(',')];
  for (const r of records) {
    const date = isoDate(r.blockTime);
    let tokenIn = '', amountIn: number | string = '';
    let tokenOut = '', amountOut: number | string = '';
    if (r.type === 'buy') {
      tokenIn = SOL; amountIn = r.solAmount;
      tokenOut = tokenIdent(r); amountOut = r.tokenAmount;
    } else if (r.type === 'sell') {
      tokenIn = tokenIdent(r); amountIn = r.tokenAmount;
      tokenOut = SOL; amountOut = r.solAmount;
    } else if (r.type === 'send') {
      tokenIn = r.tokenMint ? tokenIdent(r) : SOL;
      amountIn = r.tokenMint ? r.tokenAmount : r.solAmount;
    } else if (r.type === 'receive') {
      tokenOut = r.tokenMint ? tokenIdent(r) : SOL;
      amountOut = r.tokenMint ? r.tokenAmount : r.solAmount;
    }
    const fee = (r.feeSol || 0) + (r.priorityFeeSol || 0) + (r.gasFeeSol || 0);
    lines.push([
      date, r.type, tokenIn, amountIn, tokenOut, amountOut, fee, r.signature,
    ].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

/**
 * Token Tax 简版列(对照 CoinTracker / Koinly 通用 import 格式)
 *  Date / Type / Buy Asset / Buy Amount / Sell Asset / Sell Amount / Fee / Fee Asset
 *
 * Type:Buy / Sell / Receive / Send · 不区分 Trade(我们都是 SOL ↔ token)
 */
export function buildTokenTaxCsv(records: EnrichedTxRecord[]): string {
  const headers = [
    'Date', 'Type',
    'Buy Asset', 'Buy Amount',
    'Sell Asset', 'Sell Amount',
    'Fee', 'Fee Asset',
    'Transaction ID',
  ];
  const lines: string[] = [headers.join(',')];
  for (const r of records) {
    if (r.err) continue; // Token Tax 通常只导成功的
    const date = isoDate(r.blockTime);
    let type = '';
    let buyAsset = '', buyAmount: number | string = '';
    let sellAsset = '', sellAmount: number | string = '';
    if (r.type === 'buy') {
      type = 'Buy';
      buyAsset = tokenIdent(r); buyAmount = r.tokenAmount;
      sellAsset = SOL; sellAmount = r.solAmount;
    } else if (r.type === 'sell') {
      type = 'Sell';
      buyAsset = SOL; buyAmount = r.solAmount;
      sellAsset = tokenIdent(r); sellAmount = r.tokenAmount;
    } else if (r.type === 'receive') {
      type = 'Receive';
      buyAsset = r.tokenMint ? tokenIdent(r) : SOL;
      buyAmount = r.tokenMint ? r.tokenAmount : r.solAmount;
    } else if (r.type === 'send') {
      type = 'Send';
      sellAsset = r.tokenMint ? tokenIdent(r) : SOL;
      sellAmount = r.tokenMint ? r.tokenAmount : r.solAmount;
    } else {
      continue; // skip 'other' / 'nft_airdrop' for tax — too noisy
    }
    const fee = (r.feeSol || 0) + (r.priorityFeeSol || 0) + (r.gasFeeSol || 0);
    lines.push([
      date, type, buyAsset, buyAmount, sellAsset, sellAmount,
      fee, fee > 0 ? SOL : '', r.signature,
    ].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
