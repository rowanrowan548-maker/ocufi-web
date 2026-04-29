'use client';

/**
 * T-CHART-DEMO-V2 · 4 色红对比 · 用户挑专属品牌红
 *
 * 4 列小蜡烛图 · 共享同一份 BONK OHLC · 仅 downColor 不同 · 涨色统一 #19FB9B 青绿(--primary)
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

// T-BRAND-COLOR-ROLLOUT · 用户拍板留珊瑚粉红 · 其他 3 候选删
// 全网 brand 跌色统一 #FF6B6B(globals.css --brand-down)
const RED_CANDIDATES = [
  { name: '珊瑚粉红 · 已选', hex: '#FF6B6B' },
] as const;

const GREEN = '#19FB9B'; // T-CHART-DEMO-V4 · 真品牌青绿 (--primary · 跟反馈按钮 / logo 同色)

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
      height: 400,
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#a3a3a3',
        fontSize: 12,
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
      style={{ height: 400 }}
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
    <div className="mt-8 space-y-4">
      <div className="text-xs uppercase tracking-wider text-amber-400/80 font-mono">
        T-BRAND-COLOR-ROLLOUT · 用户已选珊瑚粉红
      </div>
      <h2 className="text-xl font-semibold">最终品牌色 · 涨青绿 · 跌珊瑚粉红</h2>
      <p className="text-sm text-muted-foreground">
        涨 <span className="font-mono text-[var(--brand-up)]">#19FB9B</span> ·
        跌 <span className="font-mono text-[var(--brand-down)]">#FF6B6B</span> ·
        全网用 globals.css <code className="font-mono text-foreground">--brand-up</code> /{' '}
        <code className="font-mono text-foreground">--brand-down</code> token
      </p>

      {/* V3 · 桌面 1 列大格 · 移动单列 · 高 400px · 标签放大 */}
      <div className="grid grid-cols-1 gap-4">
        {RED_CANDIDATES.map((c) => (
          <div key={c.hex} className="space-y-2">
            <MiniChart candles={candles} redHex={c.hex} />
            <div className="text-center text-base flex items-center justify-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-border/40"
                style={{ background: c.hex }}
                aria-hidden="true"
              />
              <span className="font-semibold text-foreground">{c.name}</span>
              <span className="font-mono text-sm text-muted-foreground">{c.hex}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

