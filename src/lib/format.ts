/**
 * 通用格式化工具
 *
 * - formatPrice: 价格小数零格式(0.0₄8575),从 price-ticker / trading-header 抽出
 * - formatCompact: 1234 → 1.23K / 1.2M / 4.5B 简写
 * - formatUsdCompact: 上行加 $
 * - formatAge: ms 时间戳 → 相对时间 i18n key 调用
 */

/** 价格显示 · 大数纯整数,小数零塌缩(0.0₄8575) */
export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  const fixed = n.toFixed(20);
  const m = fixed.match(/^0\.(0+)(\d+)/);
  if (!m) return n.toPrecision(3);
  const lead = m[1].length;
  if (lead < 4) return `0.${m[1]}${m[2].slice(0, 4)}`;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return `0.0${String(lead).split('').map((d) => subs[+d]).join('')}${m[2].slice(0, 4)}`;
}

/** 数字简写: 1234 → 1.23K, 1234567 → 1.23M, 1.2e9 → 1.20B */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

/** 美元简写($524M / $4.01M / $—) */
export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${formatCompact(n)}`;
}

/** 相对时间(ms 时间戳),走 i18n token.age.* */
export function formatAge(
  timestamp: number | null | undefined,
  t: (key: string, vars?: Record<string, string | number | Date>) => string,
): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '—';
  const ms = Date.now() - timestamp;
  if (ms < 0) return '—';
  const min = Math.floor(ms / 60_000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  const year = Math.floor(day / 365);
  if (year >= 1) return t('token.age.years', { n: year });
  if (month >= 1) return t('token.age.months', { n: month });
  if (day >= 1) return t('token.age.days', { n: day });
  if (hr >= 1) return t('token.age.hours', { n: hr });
  if (min >= 1) return t('token.age.minutes', { n: min });
  return t('token.age.justNow');
}
