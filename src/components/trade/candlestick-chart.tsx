'use client';

/**
 * T-CHART-FULL-1 · 自家蜡烛图(替换 GT iframe 的第一步)
 *
 * 数据源:fetchOhlc(mint, '5m', 300) → 走后端 /chart/ohlc 代理
 *  · 后端做 60s 缓存 + Birdeye/GT/DexScreener fallback chain · 前端只调一处
 * 颜色:涨 var(--brand-up) #19FB9B · 跌 var(--brand-down) #FF6B6B(品牌 token)
 * 库:lightweight-charts v5(已装)
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  createChart,
  CandlestickSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { Loader2, LineChart } from 'lucide-react';
import { fetchOhlc, type Timeframe } from '@/lib/ohlc';

interface Props {
  mint: string;
  timeframe?: Timeframe;
  className?: string;
}

const DEFAULT_TF: Timeframe = 'minute_5';
const DEFAULT_LIMIT = 300;

export function CandlestickChart({ mint, timeframe = DEFAULT_TF, className }: Props) {
  const t = useTranslations('trade.chart');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  // T-CHART-FULL-3 · crosshair 悬停 tooltip · O/H/L/C + time
  const [hover, setHover] = useState<null | {
    o: number; h: number; l: number; c: number; t: number;
  }>(null);

  // 创建 chart(只 1 次)
  useEffect(() => {
    if (!containerRef.current) return;
    const root = getComputedStyle(document.documentElement);
    const upColor = root.getPropertyValue('--brand-up').trim() || '#19FB9B';
    const downColor = root.getPropertyValue('--brand-down').trim() || '#FF6B6B';

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(255,255,255,0.6)',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      timeScale: { rightOffset: 4, barSpacing: 6, borderColor: 'rgba(255,255,255,0.1)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      // T-CHART-FULL-3 · 缩放 + 鼠标十字线
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 2, labelVisible: true },
        horzLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 2, labelVisible: true },
      },
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

    // T-CHART-FULL-3 · crosshair move 订阅 · 设置 hover OHLC tooltip
    const onCrosshair = (param: Parameters<Parameters<IChartApi['subscribeCrosshairMove']>[0]>[0]) => {
      if (!param.time || !param.point) {
        setHover(null);
        return;
      }
      const data = param.seriesData.get(series) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (!data) {
        setHover(null);
        return;
      }
      setHover({
        o: data.open,
        h: data.high,
        l: data.low,
        c: data.close,
        t: Number(param.time),
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 拉数据(mint / tf 变化时)
  useEffect(() => {
    if (!mint) return;
    let cancelled = false;
    setLoading(true);
    setEmpty(false);
    fetchOhlc(mint, timeframe, DEFAULT_LIMIT)
      .then((candles) => {
        if (cancelled) return;
        if (!candles.length) {
          setEmpty(true);
          return;
        }
        const data = candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        seriesRef.current?.setData(data);
        chartRef.current?.timeScale().fitContent();
      })
      .catch(() => { if (!cancelled) setEmpty(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mint, timeframe]);

  return (
    <div className={`relative w-full h-full ${className ?? ''}`}>
      <div ref={containerRef} className="absolute inset-0" data-testid="candlestick-chart" />
      {/* T-CHART-FULL-3 · 鼠标悬停 OHLC tooltip · 右上角小卡片 */}
      {hover && (
        <div
          data-testid="chart-hover-tooltip"
          className="absolute top-2 right-2 z-10 bg-card/90 border border-border/40 rounded px-2 py-1 text-[10px] font-mono tabular-nums backdrop-blur pointer-events-none"
        >
          <div className="text-muted-foreground/70">{new Date(hover.t * 1000).toLocaleString()}</div>
          <div className="flex gap-2 mt-0.5">
            <span>O <span className="text-foreground">{fmtPrice(hover.o)}</span></span>
            <span>H <span className="text-[var(--brand-up)]">{fmtPrice(hover.h)}</span></span>
            <span>L <span className="text-[var(--brand-down)]">{fmtPrice(hover.l)}</span></span>
            <span>C <span className={hover.c >= hover.o ? 'text-[var(--brand-up)]' : 'text-[var(--brand-down)]'}>{fmtPrice(hover.c)}</span></span>
          </div>
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/60 text-muted-foreground gap-2 text-sm pointer-events-none">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      )}
      {empty && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card gap-1.5">
          <LineChart className="h-6 w-6 text-muted-foreground/40" />
          <span className="text-sm font-medium text-muted-foreground">{t('noCandles')}</span>
          <span className="text-xs text-muted-foreground/60 px-4 text-center">{t('noCandlesHint')}</span>
        </div>
      )}
    </div>
  );
}

function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return '--';
  const abs = Math.abs(n);
  if (abs >= 1) return n.toFixed(4);
  if (abs >= 0.01) return n.toFixed(6);
  return n.toFixed(8);
}
