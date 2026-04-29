'use client';

/**
 * K 线卡 · GeckoTerminal embed iframe(T-708)
 *
 * 用户决策(2026-04-28 凌晨):lightweight-charts 走 ocufi-api ohlc 代理仍偶发挂,
 * V1 先稳定 → 换 GT 官方 embed iframe(GT 自家加载稳定且自带 tf 切换 / 刷新)。
 *
 * 数据流:
 *   mint → fetchTokenInfo (复用 portfolio.ts 已有的 DexScreener 调用,无新外部请求)
 *        → topPoolAddress
 *        → https://www.geckoterminal.com/solana/pools/{pool}?embed=1&info=0&swaps=0...
 *
 * iframe 参数:
 *   - embed=1 启嵌入模式
 *   - info=0 关 GT 顶部 token 条(我们有 TradingHeader)
 *   - swaps=0 关底部 trades(我们有 ActivityFeed)
 *   - light_chart=0 暗色,对得上 ocufi 配色
 *   - grayscale=0 不灰阶
 *
 * 状态:
 *   - SOL_MINT → 友好 fallback("SOL 是基础币,K 线请去 USDC/USDT 对查")
 *   - 加载中 → spinner
 *   - 无 pool / fetch 失败 → "暂无 K 线数据" / "图表服务暂时不可用"
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Loader2, LineChart, TrendingUp, Sparkles } from 'lucide-react';
import { fetchTokenInfo } from '@/lib/portfolio';
import { SOL_MINT } from '@/lib/jupiter';
import { CandlestickChart } from './candlestick-chart';

type ChartType = 'price' | 'market_cap';
type ChartSource = 'gt' | 'self';   // T-CHART-FULL-1 · 自家图 vs GT iframe

interface Props {
  mint?: string | null;
}

export function ChartCard({ mint }: Props) {
  const t = useTranslations('trade.chart');

  const [pool, setPool] = useState<string | null | undefined>(
    mint && mint !== SOL_MINT ? undefined : null
  );
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  // T-OKX-3 · Price / 市值 toggle(GT iframe 支持的唯一动态参数)
  const [chartType, setChartType] = useState<ChartType>('price');
  // T-CHART-FULL-1 · 自家图 / GT 图 toggle · 默认 GT (稳定先行) · 用户主动切换体验自家图
  const [chartSource, setChartSource] = useState<ChartSource>('gt');

  // mint → topPoolAddress(复用 portfolio.fetchTokenInfo,30s 缓存自带,无新外部请求)
  useEffect(() => {
    if (!mint || mint === SOL_MINT) {
      setPool(null);
      setLoading(false);
      setErrored(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    setPool(undefined);
    fetchTokenInfo(mint)
      .then((info) => {
        if (cancelled) return;
        setPool(info?.topPoolAddress ?? null);
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
  }, [mint]);

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

  const showSpinner = loading && pool === undefined;
  const showError = !loading && errored;
  const showEmpty = !loading && !errored && pool === null;
  const showIframe = pool && typeof pool === 'string';

  const iframeSrc = showIframe
    ? `https://www.geckoterminal.com/solana/pools/${pool}` +
      `?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=${chartType}`
    : null;

  const showSelfChart = chartSource === 'self' && pool && typeof pool === 'string';

  return (
    <Card className="overflow-hidden p-0">
      {/* T-OKX-3 + T-CHART-FULL-1 · toolbar · 价格/市值 + 自家图/GT 图 toggle */}
      {(showIframe || showSelfChart) && (
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-card/60 text-[11px]">
          <div className="inline-flex rounded border border-border/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setChartType('price')}
              className={`px-2 py-0.5 transition-colors ${
                chartType === 'price'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {t('toolbar.price')}
            </button>
            <button
              type="button"
              onClick={() => setChartType('market_cap')}
              className={`px-2 py-0.5 transition-colors ${
                chartType === 'market_cap'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {t('toolbar.marketCap')}
            </button>
          </div>
          <span className="text-muted-foreground/40">·</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground/70">
            <TrendingUp className="h-3 w-3" />
            {t('toolbar.devBuys')}
          </span>
          {/* T-CHART-FULL-1 · 自家图 / GT 图 切换 · 默认 GT */}
          <div className="ml-auto inline-flex rounded border border-border/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setChartSource('gt')}
              data-testid="chart-source-gt"
              className={`px-2 py-0.5 transition-colors ${
                chartSource === 'gt'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {t('toolbar.gtChart')}
            </button>
            <button
              type="button"
              onClick={() => setChartSource('self')}
              data-testid="chart-source-self"
              className={`px-2 py-0.5 transition-colors inline-flex items-center gap-1 ${
                chartSource === 'self'
                  ? 'bg-[var(--brand-up)]/15 text-[var(--brand-up)] font-medium'
                  : 'text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              {t('toolbar.selfChart')}
            </button>
          </div>
        </div>
      )}
      {/* T-CHART-COMPRESS · 桌面降 560→400 让一屏看到 ActivityBoard / 审计 / 持仓 */}
      <div className="relative h-[420px] sm:h-[480px] lg:h-[400px]">
        {/* T-CHART-FULL-1 · 自家蜡烛图(brand 色 · 走 /chart/ohlc 后端代理) */}
        {showSelfChart && mint && (
          <CandlestickChart mint={mint} />
        )}
        {iframeSrc && chartSource === 'gt' && (
          <iframe
            key={`${pool}-${chartType}`}
            src={iframeSrc}
            className="w-full h-full border-0"
            allow="clipboard-write"
            title="GeckoTerminal Chart"
          />
        )}
        {showSpinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-card text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('loading')}</span>
          </div>
        )}
        {showEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card gap-1.5">
            <LineChart className="h-6 w-6 text-muted-foreground/40" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('noCandles')}
            </span>
            <span className="text-xs text-muted-foreground/60 px-4 text-center">
              {t('noCandlesHint')}
            </span>
          </div>
        )}
        {showError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card gap-1.5">
            <LineChart className="h-6 w-6 text-muted-foreground/40" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('serviceUnavailable')}
            </span>
            <span className="text-xs text-muted-foreground/60 px-4 text-center">
              {t('serviceUnavailableHint')}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
