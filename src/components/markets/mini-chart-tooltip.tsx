'use client';

/**
 * T-MARKETS-DIFFER-V2 · 行 hover 0.5s → floating mini K 线 tooltip
 *
 * 数据:fetchOhlc(mint, 'hour_4', 42) · 7 天 × 6 条 4h candle
 * 渲染:lightweight-charts · 220×100px · 仅 candle · 无工具栏
 *
 * 不放在 row 内部,而是 portal 到 body · 防 overflow-hidden 切掉
 * 单例:同一时间只有 1 个 tooltip 跟随当前 hover 行
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { fetchOhlc, type OhlcCandle } from '@/lib/ohlc';

interface Props {
  mint: string;
  symbol: string;
  /** 容器在视口中的 anchor 矩形(行 BoundingClientRect) */
  anchor: DOMRect;
}

const W = 220;
const H = 100;
const Y_OFFSET = 8;

export function MiniChartTooltip({ mint, symbol, anchor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [data, setData] = useState<OhlcCandle[] | null>(null);
  const [errored, setErrored] = useState(false);

  // 拉 OHLC · 单实例(每次 hover 进新行 = 新组件) · mint 在生命周期内不变
  useEffect(() => {
    if (!mint) return;
    let cancelled = false;
    fetchOhlc(mint, 'hour_4', 42)
      .then((rows) => {
        if (cancelled) return;
        if (!rows || rows.length === 0) { setErrored(true); return; }
        setData(rows);
      })
      .catch(() => { if (!cancelled) setErrored(true); });
    return () => { cancelled = true; };
  }, [mint]);

  // 创建 chart(只 1 次 · tooltip 短命件 · 不需要 update tf)
  useEffect(() => {
    if (!containerRef.current) return;
    const root = getComputedStyle(document.documentElement);
    const upColor = root.getPropertyValue('--brand-up').trim() || '#19FB9B';
    const downColor = root.getPropertyValue('--brand-down').trim() || '#FF6B6B';

    const chart = createChart(containerRef.current, {
      width: W,
      height: H,
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(255,255,255,0.5)',
        fontSize: 9,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      timeScale: {
        visible: false,
        rightOffset: 0,
        barSpacing: 4,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      handleScroll: false,
      handleScale: false,
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 数据塞 chart
  useEffect(() => {
    if (!data || !seriesRef.current || !chartRef.current) return;
    const candles = data.map((c) => ({
      time: (c.time / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(candles);
    chartRef.current.timeScale().fitContent();
  }, [data]);

  // 计算 portal 位置(默认行下方;若靠近视口底部 → 行上方)
  const top = pickTop(anchor);
  const left = pickLeft(anchor);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      data-testid="mini-chart-tooltip"
      data-mint={mint}
      style={{
        position: 'fixed',
        top,
        left,
        width: W,
        zIndex: 60,
        pointerEvents: 'none',
      }}
      className="rounded-md border border-border/60 bg-popover text-popover-foreground shadow-lg overflow-hidden"
    >
      <div className="flex items-center justify-between px-2 py-1 text-[10px] border-b border-border/40">
        <span className="font-mono">{symbol}</span>
        <span className="text-muted-foreground/70">7d · 4h</span>
      </div>
      <div ref={containerRef} style={{ width: W, height: H }} className="relative">
        {!data && !errored && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
            <Loader2 className="h-3 w-3 animate-spin" />
          </div>
        )}
        {errored && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground/50">
            no data
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function pickTop(anchor: DOMRect): number {
  const below = anchor.bottom + Y_OFFSET;
  const aboveTop = anchor.top - H - 22 - Y_OFFSET; // 减去 header 22
  if (typeof window !== 'undefined' && below + H + 22 > window.innerHeight && aboveTop > 0) {
    return aboveTop;
  }
  return below;
}

function pickLeft(anchor: DOMRect): number {
  if (typeof window === 'undefined') return anchor.left;
  // 居中对齐 mint 列附近(行左 + 80px) · 但保证不超右边界
  const desired = anchor.left + 80;
  const max = window.innerWidth - W - 8;
  return Math.max(8, Math.min(desired, max));
}
