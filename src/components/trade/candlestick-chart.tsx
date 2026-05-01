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
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { Loader2, LineChart } from 'lucide-react';
import { fetchOhlc, type Timeframe } from '@/lib/ohlc';
import { useCostBasis } from '@/hooks/use-cost-basis';
import { useTxHistory } from '@/hooks/use-tx-history';
import { usePriceAlerts } from '@/hooks/use-price-alerts';
import { fetchPrice } from '@/lib/api-client';
import { SOL_MINT } from '@/lib/jupiter';
import { USDC_MINT } from '@/lib/preset-tokens';
import { useWallet } from '@solana/wallet-adapter-react';
import { getTriggerOrders, type TriggerOrder } from '@/lib/jupiter-trigger';
import { useChartUnit } from '@/lib/chart-unit-store';

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
  const costLineRef = useRef<IPriceLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  // T-CHART-FULL-4 · 平均买入价线 · 钱包未连或无持仓 → 不显
  const { costs } = useCostBasis();
  const [solUsdPrice, setSolUsdPrice] = useState<number>(0);
  // T-CHART-FULL-5 · 买卖点 markers · 钱包未连或无该 mint 历史 → 不显
  const { records } = useTxHistory(100);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  // T-CHART-FULL-6 · 限价单线 · 取 user active trigger orders
  const { publicKey } = useWallet();
  const [orders, setOrders] = useState<TriggerOrder[]>([]);
  const orderLinesRef = useRef<IPriceLine[]>([]);
  // T-CHART-FULL-7 · 提醒线 · 复用 usePriceAlerts(已有 20s 轮询)
  const { alerts } = usePriceAlerts();
  const alertLinesRef = useRef<IPriceLine[]>([]);
  // T-CHART-FULL-8 · USD / SOL 价格单位(后端 ohlc 返 USD · SOL 模式前端反推)
  const unit = useChartUnit();
  // T-CHART-FULL-3 · crosshair 悬停 tooltip · O/H/L/C + time
  const [hover, setHover] = useState<null | {
    o: number; h: number; l: number; c: number; t: number;
  }>(null);

  // T-CHART-FULL-4 · 拉 SOL→USD 价(把 avgCostSol 换算成 chart 的 USD 单位)
  useEffect(() => {
    let cancelled = false;
    fetchPrice(SOL_MINT)
      .then((r) => { if (!cancelled) setSolUsdPrice(r.price_usd); })
      .catch(() => { /* ignore · 没价就不画线 */ });
    return () => { cancelled = true; };
  }, []);

  // T-CHART-FULL-6 · 拉用户 active trigger orders · 30s 自动刷
  useEffect(() => {
    if (!publicKey) { setOrders([]); return; }
    let cancelled = false;
    const userPk = publicKey.toBase58();
    const load = () => {
      getTriggerOrders(userPk, 'active')
        .then((r) => { if (!cancelled) setOrders(r.orders); })
        .catch(() => { if (!cancelled) setOrders([]); });
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [publicKey]);

  // T-CHART-FULL-6 · 限价单线 · orders/mint/solUsdPrice 任一变都重画
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    // 先清旧
    for (const line of orderLinesRef.current) {
      try { series.removePriceLine(line); } catch { /* noop */ }
    }
    orderLinesRef.current = [];
    if (!mint || orders.length === 0) return;
    const root = getComputedStyle(document.documentElement);
    const upColor = root.getPropertyValue('--brand-up').trim() || '#19FB9B';
    const downColor = root.getPropertyValue('--brand-down').trim() || '#FF6B6B';
    for (const o of orders) {
      const isBuy = o.outputMint === mint;     // 买:换进 mint
      const isSell = o.inputMint === mint;     // 卖:换出 mint
      if (!isBuy && !isSell) continue;
      const making = parseFloat(o.makingAmount);
      const taking = parseFloat(o.takingAmount);
      if (!Number.isFinite(making) || !Number.isFinite(taking) || making <= 0 || taking <= 0) continue;
      // 计算 USD 单价
      let priceUsd = 0;
      if (isBuy) {
        // input → mint:price = makingAmount(input) / takingAmount(mint) × inputUsd
        const inputUsd = o.inputMint === SOL_MINT ? solUsdPrice : o.inputMint === USDC_MINT ? 1 : 0;
        if (!inputUsd) continue;
        priceUsd = (making / taking) * inputUsd;
      } else {
        // mint → output:price = takingAmount(output) / makingAmount(mint) × outputUsd
        const outputUsd = o.outputMint === SOL_MINT ? solUsdPrice : o.outputMint === USDC_MINT ? 1 : 0;
        if (!outputUsd) continue;
        priceUsd = (taking / making) * outputUsd;
      }
      if (!priceUsd || !Number.isFinite(priceUsd)) continue;
      const price = unit === 'SOL' && solUsdPrice > 0 ? priceUsd / solUsdPrice : priceUsd;
      orderLinesRef.current.push(series.createPriceLine({
        price,
        color: isBuy ? upColor : downColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${isBuy ? t('limitBuy') : t('limitSell')} ${making.toFixed(2)}`,
      }));
    }
  }, [orders, mint, solUsdPrice, unit, t]);

  // T-CHART-FULL-7 · 提醒线 · alerts/mint 任一变都重画
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const line of alertLinesRef.current) {
      try { series.removePriceLine(line); } catch { /* noop */ }
    }
    alertLinesRef.current = [];
    if (!mint || alerts.length === 0) return;
    for (const a of alerts) {
      if (a.mint !== mint) continue;
      if (a.triggered) continue;             // 已触发不显
      if (a.is_active === false) continue;   // 暂停的不显
      if (!Number.isFinite(a.target_usd) || a.target_usd <= 0) continue;
      const price = unit === 'SOL' && solUsdPrice > 0 ? a.target_usd / solUsdPrice : a.target_usd;
      alertLinesRef.current.push(series.createPriceLine({
        price,
        color: '#F59E0B',                    // amber 中性色 · 区别买卖
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `🔔 ${t('alertAt')} ${a.target_usd}`,
      }));
    }
  }, [alerts, mint, unit, solUsdPrice, t]);

  // T-CHART-FULL-5 · 买卖点 markers · records/mint 变化重设
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (!markersPluginRef.current) {
      markersPluginRef.current = createSeriesMarkers<Time>(series, []);
    }
    if (!mint) {
      markersPluginRef.current.setMarkers([]);
      return;
    }
    const root = getComputedStyle(document.documentElement);
    const upColor = root.getPropertyValue('--brand-up').trim() || '#19FB9B';
    const downColor = root.getPropertyValue('--brand-down').trim() || '#FF6B6B';
    // 过滤当前 mint 的 buy/sell · 取最近 30 笔(防卡)
    const filtered = records
      .filter((r) => (r.type === 'buy' || r.type === 'sell') && r.tokenMint === mint && r.blockTime)
      .slice(0, 30);
    const markers: SeriesMarker<Time>[] = filtered.map((r) => ({
      time: r.blockTime as unknown as Time,
      position: r.type === 'buy' ? 'belowBar' : 'aboveBar',
      color: r.type === 'buy' ? upColor : downColor,
      shape: r.type === 'buy' ? 'arrowUp' : 'arrowDown',
      text: `${r.type === 'buy' ? 'B' : 'S'} ${r.solAmount.toFixed(2)}`,
    }));
    markersPluginRef.current.setMarkers(markers);
  }, [records, mint]);

  // T-CHART-FULL-4 · 成本线 createPriceLine · costs/mint/solUsdPrice 任一变都重画
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    // 先清旧
    if (costLineRef.current) {
      try { series.removePriceLine(costLineRef.current); } catch { /* noop */ }
      costLineRef.current = null;
    }
    if (!mint || !solUsdPrice) return;
    const entry = costs.get(mint);
    if (!entry || entry.derivedBalance <= 0 || entry.avgCostSol <= 0) return;
    const root = getComputedStyle(document.documentElement);
    const upColor = root.getPropertyValue('--brand-up').trim() || '#19FB9B';
    const avgUsd = entry.avgCostSol * solUsdPrice;
    const price = unit === 'SOL' ? entry.avgCostSol : avgUsd;
    costLineRef.current = series.createPriceLine({
      price,
      color: upColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: t('myCost'),
    });
  }, [costs, mint, solUsdPrice, unit, t]);

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

  // 拉数据(mint / tf / unit 变化时)
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
        // T-CHART-FULL-9 · 数据点上限 · slice 防 1000+ 卡(实际 limit=300 已防)
        const safe = candles.slice(-1000);
        // T-CHART-FULL-8 · SOL 模式 · 用当前 SOL/USD 价反推(approx · 历史价用今价转)
        const unitDiv = unit === 'SOL' && solUsdPrice > 0 ? solUsdPrice : 1;
        const data = safe.map((c) => ({
          time: c.time as Time,
          open: c.open / unitDiv,
          high: c.high / unitDiv,
          low: c.low / unitDiv,
          close: c.close / unitDiv,
        }));
        seriesRef.current?.setData(data);
        chartRef.current?.timeScale().fitContent();
      })
      .catch(() => { if (!cancelled) setEmpty(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mint, timeframe, unit, solUsdPrice]);

  return (
    <div className={`relative w-full h-full ${className ?? ''}`}>
      <div ref={containerRef} className="absolute inset-0" data-testid="candlestick-chart" />
      {/* T-CHART-FULL-3 · 鼠标悬停 OHLC tooltip · 右上角小卡片 */}
      {hover && (
        <div
          data-testid="chart-hover-tooltip"
          className="absolute top-2 right-2 z-10 bg-card/90 border border-border/40 rounded px-2 py-1 text-[10px] font-mono tabular-nums backdrop-blur pointer-events-none"
        >
          <div className="text-muted-foreground/70">{new Date(hover.t * 1000).toLocaleString()} · {unit}</div>
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
