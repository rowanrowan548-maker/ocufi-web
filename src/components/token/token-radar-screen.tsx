'use client';

/**
 * T-943 · /token 雷达页面重写
 *
 * 4 段:
 *  1. 顶部:输入框立即查询 + 最近 10 条历史 chips
 *  2. 单 token 查询结果(有输入时):红绿灯总评 + 12 项检查清单 + 立即买入/加自选
 *  3. 24h 高风险代币榜(GET /token/radar?category=risky)
 *  4. 24h 已审计安全榜(GET /token/radar?category=safe)
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PublicKey } from '@solana/web3.js';
import { useTranslations } from 'next-intl';
import {
  Search, X, Loader2, AlertCircle, Star, ShoppingCart,
  ShieldAlert, ShieldCheck, History, ExternalLink, RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { RiskBadge } from '@/components/token/risk-badge';
import { SafetyChecklist } from '@/components/token/safety-checklist';
import { fetchTokenDetail, overallRisk, type TokenDetail } from '@/lib/token-info';
import { fetchTokenRadar, isApiConfigured, type RadarItem } from '@/lib/api-client';
import { useFavorites } from '@/lib/favorites';
import { useSearchHistory } from '@/lib/token-search-history';
import { getCurrentChain } from '@/config/chains';

export function TokenRadarScreen() {
  const t = useTranslations();
  const chain = getCurrentChain();
  const { isFavorite, toggle } = useFavorites();
  const { list: history, add: addHistory, clear: clearHistory } = useSearchHistory();

  const [mintInput, setMintInput] = useState('');
  const [activeMint, setActiveMint] = useState<string | null>(null);
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [riskyList, setRiskyList] = useState<RadarItem[]>([]);
  const [safeList, setSafeList] = useState<RadarItem[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);

  // 拉两个榜单
  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    setBoardsLoading(true);
    Promise.all([
      fetchTokenRadar('risky', 12).catch(() => []),
      fetchTokenRadar('safe', 12).catch(() => []),
    ]).then(([risky, safe]) => {
      if (cancelled) return;
      setRiskyList(risky);
      setSafeList(safe);
    }).finally(() => {
      if (!cancelled) setBoardsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // 切代币时拉 detail
  useEffect(() => {
    if (!activeMint) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    fetchTokenDetail(activeMint)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        // T-943 #62 · 加入历史
        addHistory(activeMint, d.symbol);
      })
      .catch(() => { if (!cancelled) setDetailError(t('token.notFound')); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [activeMint, addHistory, t]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = mintInput.trim();
    if (!m) { setActiveMint(null); return; }
    try {
      new PublicKey(m);
      if (m.length < 32 || m.length > 44) throw new Error();
    } catch {
      setDetailError(t('trade.errors.invalidMint'));
      return;
    }
    setActiveMint(m);
  }

  function pickFromHistory(mint: string) {
    setMintInput(mint);
    setActiveMint(mint);
  }

  function clearActive() {
    setMintInput('');
    setActiveMint(null);
    setDetail(null);
    setDetailError(null);
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
            {t('token.search.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('token.search.subtitle')}
          </p>
        </header>

        {/* 1. 搜索框 + 历史 */}
        <Card className="w-full">
          <CardContent className="p-5 space-y-3">
            <form onSubmit={submit} className="flex gap-2">
              <Input
                placeholder={t('token.search.placeholder')}
                value={mintInput}
                onChange={(e) => setMintInput(e.target.value)}
                className="font-mono text-sm flex-1"
                autoFocus
              />
              {mintInput && (
                <Button type="button" variant="ghost" size="sm" onClick={clearActive} aria-label="Clear">
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button type="submit">
                <Search className="mr-1.5 h-4 w-4" />
                <span>{t('token.search.button')}</span>
              </Button>
            </form>

            {history.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                  <History className="h-3 w-3" />
                  {t('token.history.label')}
                </span>
                {history.map((h) => (
                  <button
                    key={h.mint}
                    type="button"
                    onClick={() => pickFromHistory(h.mint)}
                    className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title={h.mint}
                  >
                    {h.symbol || `${h.mint.slice(0, 4)}…${h.mint.slice(-4)}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors ml-auto"
                >
                  {t('token.history.clear')}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. 单 token 查询结果 */}
        {activeMint && (
          <Card className="w-full">
            <CardContent className="p-5 sm:p-6 space-y-5">
              {detailLoading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{t('token.checks.loading')}</span>
                </div>
              )}
              {detailError && !detailLoading && (
                <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}
              {detail && !detailLoading && (
                <>
                  {/* 头部:logo + symbol + 总评 RiskBadge + actions */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center ring-1 ring-border/40">
                      {detail.logoUri ? (
                        <Image src={detail.logoUri} alt={detail.symbol} width={56} height={56} className="object-cover" unoptimized />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">
                          {detail.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono uppercase text-lg sm:text-xl font-bold tracking-tight">{detail.symbol}</span>
                        <RiskBadge level={overallRisk(detail)} label={t(`token.risk.${overallRisk(detail)}`)} />
                      </div>
                      {detail.name && detail.name !== detail.symbol && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{detail.name}</div>
                      )}
                      <div className="font-mono text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-2">
                        <span className="truncate">{detail.mint}</span>
                        <a
                          href={`${chain.explorer}/token/${detail.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-foreground transition-colors flex-shrink-0"
                          aria-label="Solscan"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* 行情数据 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/40">
                    <Stat label={t('token.marketCap')} value={detail.marketCap ? `$${formatCompact(detail.marketCap)}` : '—'} />
                    <Stat label={t('token.liquidity')} value={detail.liquidityUsd ? `$${formatCompact(detail.liquidityUsd)}` : '—'} />
                    <Stat label={t('token.volume24h')} value={detail.volume24h ? `$${formatCompact(detail.volume24h)}` : '—'} />
                    <Stat
                      label="Price"
                      value={detail.priceUsd ? `$${formatPrice(detail.priceUsd)}` : '—'}
                      hint={detail.priceChange24h != null
                        ? `${detail.priceChange24h >= 0 ? '+' : ''}${detail.priceChange24h.toFixed(2)}%`
                        : undefined}
                      hintColor={
                        detail.priceChange24h == null
                          ? ''
                          : detail.priceChange24h >= 0
                          ? 'text-success'
                          : 'text-danger'
                      }
                    />
                  </div>

                  {/* 12 项检查清单 */}
                  <div className="pt-3 border-t border-border/40 space-y-3">
                    <div className="text-sm font-semibold">{t('token.safetyChecks')}</div>
                    <SafetyChecklist detail={detail} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/40">
                    <Link href={`/trade?mint=${detail.mint}`} className="flex-1">
                      <Button className="w-full">
                        <ShoppingCart className="h-4 w-4 mr-1.5" />
                        {t('token.actions.buy')}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => toggle(detail.mint)}
                    >
                      <Star className={`h-4 w-4 mr-1.5 ${isFavorite(detail.mint) ? 'fill-warning text-warning' : ''}`} />
                      {isFavorite(detail.mint) ? t('token.actions.unstar') : t('token.actions.star')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3. 24h 高风险榜 */}
        <RadarBoard
          title={t('token.radar.risky.title')}
          subtitle={t('token.radar.risky.subtitle')}
          icon={ShieldAlert}
          iconColor="text-danger"
          items={riskyList}
          loading={boardsLoading}
          onPick={(mint) => { setMintInput(mint); setActiveMint(mint); }}
          tone="risky"
        />

        {/* 4. 24h 安全榜 */}
        <RadarBoard
          title={t('token.radar.safe.title')}
          subtitle={t('token.radar.safe.subtitle')}
          icon={ShieldCheck}
          iconColor="text-success"
          items={safeList}
          loading={boardsLoading}
          onPick={(mint) => { setMintInput(mint); setActiveMint(mint); }}
          tone="safe"
        />

        <div className="text-[10px] text-muted-foreground/70 text-center pt-2">
          {t('token.page.poweredBy')}
        </div>
      </div>
    </main>
  );
}

function Stat({
  label, value, hint, hintColor,
}: {
  label: string;
  value: string;
  hint?: string;
  hintColor?: string;
}) {
  return (
    <div className="space-y-0.5 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-mono font-semibold truncate">{value}</div>
      {hint && <div className={`text-[10px] font-mono ${hintColor ?? 'text-muted-foreground'}`}>{hint}</div>}
    </div>
  );
}

function RadarBoard({
  title, subtitle, icon: Icon, iconColor, items, loading, onPick, tone,
}: {
  title: string;
  subtitle: string;
  icon: typeof ShieldAlert;
  iconColor: string;
  items: RadarItem[];
  loading: boolean;
  onPick: (mint: string) => void;
  tone: 'risky' | 'safe';
}) {
  const t = useTranslations();
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-[10px] text-muted-foreground">{subtitle}</span>
      </div>

      {loading && items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {t('token.radar.loading')}
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-xs text-muted-foreground/70">
          {t('token.radar.empty')}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((it) => (
            <button
              key={it.mint}
              type="button"
              onClick={() => onPick(it.mint)}
              className={`text-left rounded-lg border bg-card/40 p-3 hover:bg-card transition-colors ${
                tone === 'risky' ? 'border-danger/20 hover:border-danger/40' : 'border-success/20 hover:border-success/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium font-mono uppercase truncate">{it.symbol || it.mint.slice(0, 4)}</span>
                {it.priceChange24h != null && (
                  <span className={`text-[10px] font-mono ${it.priceChange24h >= 0 ? 'text-success' : 'text-danger'}`}>
                    {it.priceChange24h >= 0 ? '+' : ''}{it.priceChange24h.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                {it.name || it.mint.slice(0, 12) + '…'}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/80 mt-2">
                {it.priceUsd != null && <span>${formatPrice(it.priceUsd)}</span>}
                {it.liquidityUsd != null && <span>· LP ${formatCompact(it.liquidityUsd)}</span>}
              </div>
              {tone === 'risky' && it.riskReasons.length > 0 && (
                <div className="text-[10px] text-danger/80 mt-1 truncate" title={it.riskReasons.join(', ')}>
                  ⚠ {it.riskReasons.slice(0, 2).join(' · ')}
                  {it.riskReasons.length > 2 && ` +${it.riskReasons.length - 2}`}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function formatCompact(n: number): string {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function formatPrice(n: number): string {
  if (!n) return '—';
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toPrecision(3);
}
