'use client';

/**
 * 服务状态页 · 探活外部依赖
 *
 * 真实可用性检测,30 秒自动刷新。每个服务展示:状态点 / 名称 / 延迟 / 用途说明
 *
 * 注:由于浏览器 CORS,Solana RPC / Helius / GeckoTerminal 等可能从浏览器无法 fetch,
 *      退而求其次:用 image / no-cors fetch + 时延做近似探测
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Health = 'healthy' | 'degraded' | 'down' | 'checking';

interface ServiceProbe {
  id: string;
  /** 用户可读的服务名 */
  name: string;
  /** 这个服务在产品里干什么 */
  purpose: string;
  /** 探活 URL,GET 期望 ok */
  url: string;
  /** 不接收 CORS 时改用 no-cors mode(只能判存活,不能读 body) */
  noCors?: boolean;
}

const PROBES: ServiceProbe[] = [
  {
    id: 'dexscreener',
    name: 'DexScreener',
    purpose: '行情 / 价格 / 交易对',
    url: 'https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112',
  },
  {
    id: 'gt',
    name: 'GeckoTerminal',
    purpose: '成交活动 feed',
    url: 'https://api.geckoterminal.com/api/v2/networks/solana/tokens/So11111111111111111111111111111111111111112/pools?page=1',
  },
  {
    id: 'rugcheck',
    name: 'RugCheck',
    purpose: '代币安全审查',
    url: 'https://api.rugcheck.xyz/v1/tokens/So11111111111111111111111111111111111111112/report',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    purpose: '聚合报价 + swap',
    url: 'https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000',
  },
  {
    id: 'api',
    name: 'Ocufi API',
    purpose: '积分 / 后端',
    url: (process.env.NEXT_PUBLIC_API_URL ?? '') + '/health',
  },
];

interface ProbeResult {
  health: Health;
  latencyMs?: number;
  checkedAt?: number;
  error?: string;
}

export function StatusBoard() {
  const t = useTranslations('status');
  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  const [refreshing, setRefreshing] = useState(false);

  async function probeAll() {
    setRefreshing(true);
    const out: Record<string, ProbeResult> = {};
    await Promise.all(
      PROBES.map(async (p) => {
        if (!p.url || p.url.endsWith('/health') && !process.env.NEXT_PUBLIC_API_URL) {
          out[p.id] = { health: 'down', error: 'not configured' };
          return;
        }
        const start = Date.now();
        try {
          const res = await fetch(p.url, {
            cache: 'no-store',
            signal: AbortSignal.timeout(8_000),
            mode: p.noCors ? 'no-cors' : 'cors',
          });
          const latency = Date.now() - start;
          if (p.noCors) {
            // no-cors 没法读 status,只要 fetch 成功就算 OK
            out[p.id] = { health: 'healthy', latencyMs: latency, checkedAt: Date.now() };
          } else if (res.ok) {
            out[p.id] = {
              health: latency > 3000 ? 'degraded' : 'healthy',
              latencyMs: latency,
              checkedAt: Date.now(),
            };
          } else {
            out[p.id] = {
              health: 'down',
              latencyMs: latency,
              checkedAt: Date.now(),
              error: `HTTP ${res.status}`,
            };
          }
        } catch (e: unknown) {
          out[p.id] = {
            health: 'down',
            checkedAt: Date.now(),
            error: e instanceof Error ? e.message : String(e),
          };
        }
      })
    );
    setResults(out);
    setRefreshing(false);
  }

  useEffect(() => {
    probeAll();
    const id = setInterval(probeAll, 30_000);
    return () => clearInterval(id);
  }, []);

  // 整体状态
  const list = Object.values(results);
  const allHealthy = list.length > 0 && list.every((r) => r.health === 'healthy');
  const anyDown = list.some((r) => r.health === 'down');

  return (
    <main className="flex flex-1 flex-col">
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>

        {/* 整体状态条 */}
        <Card
          className={[
            'p-5 flex items-center justify-between gap-3',
            allHealthy
              ? 'border-success/30 bg-success/5'
              : anyDown
              ? 'border-danger/30 bg-danger/5'
              : 'border-warning/30 bg-warning/5',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            {list.length === 0 ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : allHealthy ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <AlertCircle className={`h-5 w-5 ${anyDown ? 'text-danger' : 'text-warning'}`} />
            )}
            <div>
              <div className="text-base font-semibold">
                {list.length === 0
                  ? t('overall.checking')
                  : allHealthy
                  ? t('overall.healthy')
                  : anyDown
                  ? t('overall.down')
                  : t('overall.degraded')}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t('overall.refreshHint')}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={probeAll}
            disabled={refreshing}
            className="h-8 px-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </Card>

        {/* 服务清单 */}
        <Card>
          <CardContent className="p-0 divide-y divide-border/40">
            {PROBES.map((p) => {
              const r = results[p.id];
              return (
                <div key={p.id} className="flex items-center gap-3 p-4">
                  <StatusDot health={r?.health ?? 'checking'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{p.name}</span>
                      {r?.latencyMs != null && (
                        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                          {r.latencyMs}ms
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {p.purpose}
                    </div>
                    {r?.error && (
                      <div className="text-[10px] font-mono text-danger/70 mt-1 truncate">
                        {r.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground/70 text-center pt-2">
          {t('disclaimer')}
        </div>
      </div>
    </main>
  );
}

function StatusDot({ health }: { health: Health }) {
  const color =
    health === 'healthy'
      ? 'bg-success'
      : health === 'degraded'
      ? 'bg-warning'
      : health === 'down'
      ? 'bg-danger'
      : 'bg-muted-foreground/40';
  return (
    <span className="relative flex h-3 w-3 flex-shrink-0">
      {health === 'healthy' && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-50 animate-ping`} />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
    </span>
  );
}
