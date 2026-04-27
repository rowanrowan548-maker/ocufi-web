/**
 * BigInt-based raw amount → ui 数字符串(无浮点损失)
 *
 * 适用场景:
 *  - 卖出 setPct(100) 显示 token 数量(防 meme 大持仓 Number() 损精度)
 *  - quote.inAmount / outAmount 显示(quote 的 in/out 是 raw string)
 *  - analytics / toast 显示 token 数(避免 "8999999.99" → "8999999.5" 偏差)
 *
 * 为什么需要:
 *  Number(rawAmount) / 10^decimals 在 raw > 2^53 ≈ 9e15 时丢精度。
 *  常见踩坑场景:meme 币(decimals=6)余额 > 90 亿 / SPL(decimals=9)余额 > 900 万。
 *  虽然不影响链上交易(链上量走 raw BigInt),但 UI 显示 / analytics 上报失真。
 *
 * 不依赖 bignumber.js(降低包体积),用原生 BigInt + 字符串切位实现。
 */

/** 标准化 raw 输入为「无符号字符串 + 是否负」 */
function normalizeRaw(raw: string | bigint): { abs: string; neg: boolean } {
  if (typeof raw === 'bigint') {
    if (raw < BigInt(0)) return { abs: (-raw).toString(), neg: true };
    return { abs: raw.toString(), neg: false };
  }
  const s = String(raw).trim();
  if (s.startsWith('-')) return { abs: s.slice(1), neg: true };
  return { abs: s, neg: false };
}

/**
 * raw → ui 完整精度字符串(去末尾 0)
 *
 * 例:rawToUiString('123450', 4) → '12.345'
 *     rawToUiString('123', 6)    → '0.000123'
 *     rawToUiString('1000000000', 9) → '1'
 */
export function rawToUiString(raw: string | bigint, decimals: number): string {
  if (decimals <= 0) return BigInt(typeof raw === 'string' ? raw : raw).toString();
  const { abs, neg } = normalizeRaw(raw);
  // 补 0 到至少 decimals+1 位(保证整数部分至少 1 位)
  const padded = abs.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
  const out = fracPart ? `${intPart}.${fracPart}` : intPart;
  return neg ? `-${out}` : out;
}

/**
 * raw → ui 固定小数位字符串(BigInt 四舍五入)
 *
 * 例:rawToUiFixed('123456', 4, 2)  → '12.35'
 *     rawToUiFixed('1234999', 4, 2) → '123.50'
 *     rawToUiFixed('100', 6, 4)     → '0.0001'
 */
export function rawToUiFixed(raw: string | bigint, decimals: number, dp: number): string {
  const safeDp = Number.isFinite(dp) && dp >= 0 ? Math.floor(dp) : 0;
  const { abs, neg } = normalizeRaw(raw);

  // dp >= decimals:不需要舍入,直接补 0 到 dp 位
  if (safeDp >= decimals) {
    const padded = abs.padStart(decimals + 1, '0');
    const intPart = padded.slice(0, padded.length - decimals);
    let fracPart = padded.slice(padded.length - decimals);
    while (fracPart.length < safeDp) fracPart += '0';
    const out = safeDp > 0 ? `${intPart}.${fracPart}` : intPart;
    return neg ? `-${out}` : out;
  }

  // dp < decimals:截掉末尾 (decimals - dp) 位,半进位舍入
  const cut = decimals - safeDp;
  const cutFactor = BigInt(10) ** BigInt(cut);
  const half = cutFactor / BigInt(2);
  const rawBig = BigInt(abs || '0');
  const rounded = (rawBig + half) / cutFactor;

  if (safeDp === 0) {
    return neg ? `-${rounded.toString()}` : rounded.toString();
  }
  const padded = rounded.toString().padStart(safeDp + 1, '0');
  const intPart = padded.slice(0, padded.length - safeDp);
  const fracPart = padded.slice(padded.length - safeDp);
  return `${neg ? '-' : ''}${intPart}.${fracPart}`;
}

/**
 * 判断 raw 表示的 ui 数是否 ≥ 1(无 Number 转换,纯字符串比较)
 *
 * 用于:sell-form setPct(100) 内"≥1 用 toFixed(4) 否则 toFixed(9)"分支决策
 *
 * 例:rawGreaterOrEqualToOne('1000000000', 9) → true  (= 1.0)
 *     rawGreaterOrEqualToOne('999999999', 9)  → false (= 0.999...)
 *     rawGreaterOrEqualToOne('100', 6)        → false (= 0.0001)
 */
export function rawGreaterOrEqualToOne(raw: string | bigint, decimals: number): boolean {
  if (decimals <= 0) {
    if (typeof raw === 'bigint') return raw >= BigInt(1);
    const v = String(raw).trim().replace(/^-/, '');
    return BigInt(v || '0') >= BigInt(1);
  }
  const { abs, neg } = normalizeRaw(raw);
  if (neg) return false;
  // ui >= 1 ⟺ abs >= 10^decimals ⟺ abs.length > decimals(去前导 0 后)
  const trimmed = abs.replace(/^0+/, '') || '0';
  return trimmed.length > decimals;
}

/**
 * raw → ui Number(可能丢精度,仅为 analytics / 老 API 兼容用)
 *
 * 等价于 `Number(rawToUiString(raw, decimals))`,但更明确告诉调用方"我接受精度损失"
 *
 * 优先用 rawToUiString / rawToUiFixed 输出字符串,避免精度损失
 */
export function rawToUiNumber(raw: string | bigint, decimals: number): number {
  return Number(rawToUiString(raw, decimals));
}
