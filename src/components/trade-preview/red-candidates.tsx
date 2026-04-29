'use client';

/**
 * T-CHART-DEMO-V2 · 4 色红对比 · 用户挑专属品牌红
 *
 * 4 列小蜡烛图 · 共享同一份 BONK OHLC · 仅 downColor 不同 · 涨色统一 emerald-500(logo 同色)
 * 桌面 4 列横排 · 移动 2x2 grid
 * 不画成本线 / 买入气泡(对比纯看颜色)
 */
import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import { fetchOhlc, type OhlcCandle } from '@/lib/ohlc';

const RED_CANDIDATES = [
  { name: '朱红', hex: '#E63946' },
  { name: '熔岩红', hex: '#FF4D2E' },
  { name: '宝石红', hex: '#DC143C' },
  { name: '珊瑚粉红', hex: '#FF6B6B' },
] as const;

const GREEN = '#10b981'; // emerald-500 · logo 4 弧绿

// 同 chart-demo · CORS 兜底
function generateSyntheticCandles(): OhlcCandle[] {
  const now = Math.floor(Date.now() / 1000);
  const candles: OhlcCandle[] = [];
  let price = 0.0001;
  for (let i = 0; i < 100; i++) {
    const time = now - (100 - i) * 5 * 60;
    const drift = (Math.random() - 0.5) * 0.06;
    const spike = Math.random() > 0.93 ? (Math.random() - 0.5) * 0.2 : 0;
    const close = price * (1 + drift + spike);
    const open = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    candles.push({ time, open, high, low, close, volume: 0 });
    price = close;
  }
  return candles;
}

interface MiniProps {
  candles: OhlcCandle[];
  redHex: string;
}

function MiniChart({ candles, redHex }: MiniProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current || candles.length === 0) return;
    const container = ref.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 220,
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#737373',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: '#262626' },
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    const series = chart.addSeries(CandlestickSeries, {
      upColor: GREEN,
      downColor: redHex,
      borderUpColor: GREEN,
      borderDownColor: redHex,
      wickUpColor: GREEN,
      wickDownColor: redHex,
    });
    series.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chart.timeScale().fitContent();

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, redHex]);

  return (
    <div
      ref={ref}
      className="rounded-lg border border-border/40 overflow-hidden bg-[#0a0a0a]"
      style={{ height: 220 }}
    />
  );
}

interface Props {
  mint: string;
}

export function RedCandidates({ mint }: Props) {
  const [candles, setCandles] = useState<OhlcCandle[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let data: OhlcCandle[] = [];
      try {
        data = await fetchOhlc(mint, 'minute_5', 100);
      } catch {
        data = [];
      }
      if (cancelled) return;
      if (!data.length) data = generateSyntheticCandles();
      setCandles(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [mint]);

  return (
    <div className="mt-8 space-y-3">
      <div className="text-xs uppercase tracking-wider text-amber-400/80 font-mono">
        T-CHART-DEMO-V2 · 4 色红对比
      </div>
      <h2 className="text-lg font-semibold">挑一个红色 · 后续完整版用</h2>
      <p className="text-xs text-muted-foreground">
        涨色统一 emerald-500(跟 logo 4 弧绿同色)· 跌色为 4 个候选 · 数据共享 BONK 5m
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {RED_CANDIDATES.map((c) => (
          <div key={c.hex} className="space-y-1.5">
            <MiniChart candles={candles} redHex={c.hex} />
            <div className="text-center text-xs">
              <span className="text-foreground">{c.name}</span>
              <span className="ml-1.5 font-mono text-muted-foreground">{c.hex}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

