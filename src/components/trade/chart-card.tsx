'use client';

/**
 * K 线卡 · TradingView Lightweight Charts 自渲染
 *
 * T-700b/fix:走 ocufi-api 后端代理 `/chart/ohlc?mint=...`(后端处理 mint→pool 解析 + 60s 缓存)
 * 前端再叠 30s 缓存,失败 stale-while-error → [],替代之前的 DexScreener iframe。
 *
 * - 6 时间框架切换:1m / 5m / 15m / 1h / 4h / 1d(默认 4h)
 * - K线 + Volume 双轴(Volume 占下 25%)
 * - 阳绿 #19FB9B / 阴红 #FF3B5C(品牌色)
 * - autoSize 自动响应容器宽度变化
 * - 切 mint / 切 tf 时清旧数据再拉
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Loader2, LineChart } from 'lucide-react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { fetchOhlc, type Timeframe, type OhlcCandle } from '@/lib/ohlc';
import { SOL_MINT } from '@/lib/jupiter';
import { formatPrice } from '@/lib/format';

const UP_COLOR = '#19FB9B';
const DOWN_COLOR = '#FF3B5C';
const VOLUME_SCALE_ID = 'volume';

const TIMEFRAMES: { tf: Timeframe; key: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' }[] = [
  { tf: 'minute_1', key: '1m' },
  { tf: 'minute_5', key: '5m' },
  { tf: 'minute_15', key: '15m' },
  { tf: 'hour_1', key: '1h' },
  { tf: 'hour_4', key: '4h' },
  { tf: 'day_1', key: '1d' },
];

interface Props {
  mint?: string | null;
}

export function ChartCard({ mint }: Props) {
  const t = useTranslations('trade.chart');
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [tf, setTf] = useState<Timeframe>('hour_4');
  const [candles, setCandles] = useState<OhlcCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  // BUG-023:strict mode 双 mount 时,第二次 mount 后 series ref 是新的但 candles 没变
  // candle effect 不会重跑 → 空白。chartReady 翻转触发数据 effect 把 candles 推进新 series。
  const [chartReady, setChartReady] = useState(false);

  // ── 1. 初始化 chart(挂载一次) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(161, 161, 170, 0.85)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      // T-702:极小价格币(0.00001 量级)右侧 Price Line label 显示 0 → 用零塌缩格式
      localization: {
        priceFormatter: (p: number) => formatPrice(p),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      // T-702:custom priceFormat · minMove 1e-9 给极小价格留足精度,
      // 否则 lightweight-charts 默认 minMove 0.01 会把所有 < 0.005 的价格 round 到 0
      priceFormat: {
        type: 'custom',
        formatter: (p: number) => formatPrice(p),
        minMove: 0.000000001,
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: VOLUME_SCALE_ID,
      color: UP_COLOR,
    });
    chart.priceScale(VOLUME_SCALE_ID).applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;
    setChartReady(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      setChartReady(false);
    };
  }, []);

  // ── 2. 拉 OHLC(T-700b-fix:直接传 mint 给后端,后端处理 mint→pool 解析) ──
  useEffect(() => {
    if (!mint || mint === SOL_MINT) {
      // SOL 是基础币,无独立 LP 池(应去 SOL/USDC 等池查 K 线),早走 fallback
      setCandles([]);
      setLoading(false);
      setErrored(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    setCandles([]);
    fetchOhlc(mint, tf)
      .then((c) => {
        if (cancelled) return;
        setCandles(c);
        // BUG-024:fetch 成功但空数据 ≠ 失败,空数据走 showEmpty 路径
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mint, tf]);

  // ── 3. 推数据到 series · deps 含 chartReady,strict mode 第二次 mount 后会重推 ──
  useEffect(() => {
    if (!chartReady) return;
    const candleSeries = candleRef.current;
    const volumeSeries = volumeRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? `${UP_COLOR}66` : `${DOWN_COLOR}66`,
      })),
    );
    if (candles.length > 0) {
      chart.timeScale().fitContent();
    }
  }, [candles, chartReady]);

  // BUG-024:三态严格区分(T-700b-fix:pool 解析在后端,前端不再跟踪)
  // - showSpinner:fetch 中且无数据可显
  // - showError:fetch catch 抛错(errored=true)
  // - showEmpty:fetch 完成但无 LP / 无数据(后端 ok=false 或返空 ohlcv_list 都走这)
  const showSpinner = loading && candles.length === 0;
  const showError = !loading && errored && candles.length === 0;
  const showEmpty = !loading && !errored && candles.length === 0;

  // SOL 基础币无独立 LP 池,K 线请去 SOL/USDC 等池查 → 友好 fallback
  if (mint === SOL_MINT) {
    return (
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-1.5">
          <LineChart className="h-6 w-6 text-muted-foreground/40 mb-1" />
          <span className="text-sm font-medium">{t('solBaseFallback')}</span>
          <span className="text-xs text-muted-foreground/60 px-4 text-center">
            {t('solBaseHint')}
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* 工具栏:6 个时间框架 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/40 overflow-x-auto">
        {TIMEFRAMES.map(({ tf: t2, key }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTf(t2)}
            className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium whitespace-nowrap transition-colors ${
              tf === t2
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {t(`timeframes.${key}`)}
          </button>
        ))}
      </div>

      {/* 图表容器 */}
      <div className="relative h-[420px] sm:h-[480px]">
        <div ref={containerRef} className="w-full h-full" />
        {showSpinner && (
          <Overlay>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('loading')}</span>
          </Overlay>
        )}
        {showEmpty && (
          <Overlay>
            <LineChart className="h-6 w-6 text-muted-foreground/40" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('noCandles')}
            </span>
            <span className="text-xs text-muted-foreground/60 px-4 text-center">
              {t('noCandlesHint')}
            </span>
          </Overlay>
        )}
        {showError && (
          <Overlay>
            <LineChart className="h-6 w-6 text-muted-foreground/40" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('serviceUnavailable')}
            </span>
            <span className="text-xs text-muted-foreground/60 px-4 text-center">
              {t('serviceUnavailableHint')}
            </span>
          </Overlay>
        )}
      </div>
    </Card>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm pointer-events-none gap-1.5">
      {children}
    </div>
  );
}
