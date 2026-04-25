'use client';

/**
 * 极简 sparkline · 用 DexScreener 4 个时点的 priceChange 构造 5 个锚点
 *
 * priceChange.h24 / h6 / h1 / m5 都是相对当前价格的百分比变化,
 * 反推出每个时点的价格 = current / (1 + change/100)
 *
 * 5 点连成线,涨绿跌红
 *
 * 限制:只 5 个点,不是真 OHLCV;但相比凭空 SVG 已经反映了真实趋势,且零额外网络请求
 */
interface Props {
  priceUsd: number;
  change24h?: number;
  change6h?: number;
  change1h?: number;
  change5m?: number;
  width?: number;
  height?: number;
}

export function MiniSparkline({
  priceUsd, change24h, change6h, change1h, change5m,
  width = 60, height = 20,
}: Props) {
  if (!priceUsd || priceUsd <= 0) {
    return <div style={{ width, height }} />;
  }

  // 5 锚点(从最远到最近)。任一字段缺失就用 0(没变化)代替
  const points: number[] = [
    priceFromPctChange(priceUsd, change24h),
    priceFromPctChange(priceUsd, change6h),
    priceFromPctChange(priceUsd, change1h),
    priceFromPctChange(priceUsd, change5m),
    priceUsd,
  ];

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || max * 0.001 || 1;
  const W = width;
  const H = height;
  const pad = 2;

  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - 2 * pad));
  const ys = points.map((p) => H - pad - ((p - min) / range) * (H - 2 * pad));

  const linePath = points
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ');

  // 涨跌取最后一段方向
  const up = points[points.length - 1] >= points[0];
  const stroke = up ? 'oklch(0.85 0.25 155)' : 'oklch(0.7 0.22 30)';

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="flex-shrink-0"
      preserveAspectRatio="none"
    >
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </svg>
  );
}

function priceFromPctChange(currentPrice: number, pctChange?: number): number {
  if (pctChange == null || !Number.isFinite(pctChange)) return currentPrice;
  return currentPrice / (1 + pctChange / 100);
}
