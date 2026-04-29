'use client';

/**
 * T-CHART-DEMO · 自家 K 线 demo client 组件
 *
 * 范围(spec 严格)· 只验视觉:
 *  - 蜡烛 1 个 · 5m 固定 · 高 400px · 黑底品牌绿涨红跌
 *  - 1 条紫色虚线 mock "你的成本价"(中位数 close)
 *  - 2 个绿三角形 mock "我的买入点"(随机选 2 个 candle 时间)
 *
 * 不做(留给完整版):时间段切换 / 缩放 / 鼠标十字线 / 画线工具 / 成交量副图
 */
import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  LineStyle,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import { fetchOhlc, type OhlcCandle } from '@/lib/ohlc';

// 后端 CORS 只放 ocufi.io · localhost dev 拉不到 · 生成 100 根合成蜡烛兜底
// 真实数据走 fetchOhlc · 失败/空回这里 · 让用户随时能看视觉效果
function generateSyntheticCandles(): OhlcCandle[] {
  const now = Math.floor(Date.now() / 1000);
  const candles: OhlcCandle[] = [];
  let price = 0.0001;
  for (let i = 0; i < 100; i++) {
    const time = now - (100 - i) * 5 * 60;
    // ±3% 随机游走 · 偶发 ±10% 大波动
    const drift = (Math.random() - 0.5) * 0.06;
    const spike = Math.random() > 0.93 ? (Math.random() - 0.5) * 0.2 : 0;
    const close = price * (1 + drift + spike);
    const open = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: Math.random() * 50000 + 5000,
    });
    price = close;
  }
  return candles;
}

interface Props {
  mint: string;
}

export function ChartDemo({ mint }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [candleCount, setCandleCount] = useState(0);
  const [mockCost, setMockCost] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 黑底品牌绿涨红跌
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#a3a3a3',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#262626',
      },
    });
    chartRef.current = chart;

    // ResizeObserver: 容器宽变化时跟随
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    let cancelled = false;
    (async () => {
      let candles: OhlcCandle[] = [];
      let usedFallback = false;
      try {
        candles = await fetchOhlc(mint, 'minute_5', 100);
      } catch {
        candles = [];
      }
      if (cancelled) return;
      if (!candles.length) {
        candles = generateSyntheticCandles();
        usedFallback = true;
      }

      try {

        // 蜡烛系列 · 品牌绿涨红跌
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#19FB9B',         // 品牌青绿(--primary · 跟反馈按钮 / logo 同色)
          downColor: '#f43f5e',       // rose-500(待 V5 用户挑色后换)
          borderUpColor: '#19FB9B',
          borderDownColor: '#f43f5e',
          wickUpColor: '#19FB9B',
          wickDownColor: '#f43f5e',
        });
        candleSeries.setData(
          candles.map((c) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })),
        );

        // mock "你的成本价" 紫色虚线 · 用 close 中位数
        const closes = [...candles.map((c) => c.close)].sort((a, b) => a - b);
        const median = closes[Math.floor(closes.length / 2)];
        const cost = median;
        setMockCost(cost);

        const costSeries = chart.addSeries(LineSeries, {
          color: '#a78bfa',           // violet-400
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        costSeries.setData(
          candles.map((c) => ({ time: c.time as Time, value: cost })),
        );

        // mock "我的买入点" 2 个绿三角形 · 取 1/3 和 2/3 处
        const buyAt1 = candles[Math.floor(candles.length / 3)];
        const buyAt2 = candles[Math.floor((candles.length * 2) / 3)];
        if (buyAt1 && buyAt2) {
          createSeriesMarkers(candleSeries, [
            {
              time: buyAt1.time as Time,
              position: 'belowBar',
              color: '#19FB9B',
              shape: 'arrowUp',
              text: `买入 $${buyAt1.close.toPrecision(3)}`,
            },
            {
              time: buyAt2.time as Time,
              position: 'belowBar',
              color: '#19FB9B',
              shape: 'arrowUp',
              text: `买入 $${buyAt2.close.toPrecision(3)}`,
            },
          ]);
        }

        chart.timeScale().fitContent();
        setCandleCount(candles.length);
        setStatus(usedFallback ? 'fallback' : 'ready');
      } catch (e) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('[chart-demo] render failed', e);
        }
      }
    })();

    return () => {
      cancelled = true;
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [mint]);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="rounded-lg border border-border/40 overflow-hidden bg-[#0a0a0a]"
        style={{ height: 400 }}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {status === 'loading' && '加载 OHLC 中...'}
          {status === 'ready' && `${candleCount} 根 5m 蜡烛 · 真数据(ocufi-api)`}
          {status === 'fallback' && `${candleCount} 根 5m 蜡烛 · 合成数据(localhost CORS · prod 走真数据)`}
        </span>
        {mockCost && (
          <span className="font-mono text-violet-400">
            mock 成本价 ≈ ${mockCost.toPrecision(4)}
          </span>
        )}
      </div>
    </div>
  );
}
