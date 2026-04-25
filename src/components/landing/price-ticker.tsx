'use client';

/**
 * 顶部价格 ticker · 横向滚动主流币行情
 *
 * 设计:
 *  - 内容用 CSS keyframe 匀速横滚,hover 暂停
 *  - 内容序列复制两份(seamless loop:第一份滚出去时第二份接上)
 *  - 30s 后台轮询刷价
 *  - 点任意条目跳 /trade?mint=...
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fetchTokensInfoBatch, type TokenInfo } from '@/lib/portfolio';
import { PRESET_MAJORS, PRESET_MEME } from '@/lib/preset-tokens';

const TICKER_MINTS = Array.from(new Set([...PRESET_MAJORS, ...PRESET_MEME]));
const REFRESH_MS = 30_000;

export function PriceTicker() {
  const [items, setItems] = useState<TokenInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const map = await fetchTokensInfoBatch(TICKER_MINTS);
      if (cancelled) return;
      // 过滤 logo 缺失,按 24h 成交量排序
      const list = Array.from(map.values())
        .filter((t) => !!t.logoUri)
        .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
      setItems(list);
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (items.length === 0) return null;

  // 复制一份做 seamless loop
  const looped = [...items, ...items];

  return (
    <div className="border-b border-border/40 bg-card/30 overflow-hidden">
      <div className="ocufi-ticker flex gap-6 py-2 hover:[animation-play-state:paused]">
        {looped.map((tok, i) => (
          <Link
            key={`${tok.mint}-${i}`}
            href={`/trade?mint=${tok.mint}`}
            className="flex items-center gap-2 flex-shrink-0 hover:text-primary transition-colors"
          >
            {tok.logoUri && (
              <Image
                src={tok.logoUri}
                alt={tok.symbol}
                width={16}
                height={16}
                className="rounded-full object-cover"
                unoptimized
              />
            )}
            <span className="text-xs font-medium">{tok.symbol}</span>
            <span className="text-xs font-mono text-muted-foreground">
              ${formatPrice(tok.priceUsd)}
            </span>
            <ChangeBadge change={tok.priceChange24h} />
          </Link>
        ))}
      </div>
      <style jsx>{`
        .ocufi-ticker {
          width: max-content;
          animation: ocufi-ticker-scroll 60s linear infinite;
        }
        @keyframes ocufi-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function ChangeBadge({ change }: { change?: number }) {
  if (change == null) return null;
  const up = change > 0;
  const down = change < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : null;
  const color = up ? 'text-success' : down ? 'text-danger' : 'text-muted-foreground';
  return (
    <span className={`text-[11px] font-mono flex items-center gap-0.5 ${color}`}>
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {up ? '+' : ''}{change.toFixed(2)}%
    </span>
  );
}

function formatPrice(n: number): string {
  if (!n) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  const fixed = n.toFixed(20);
  const m = fixed.match(/^0\.(0+)(\d+)/);
  if (!m) return n.toPrecision(3);
  const lead = m[1].length;
  if (lead < 4) return `0.${m[1]}${m[2].slice(0, 4)}`;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return `0.0${String(lead).split('').map((d) => subs[+d]).join('')}${m[2].slice(0, 4)}`;
}
