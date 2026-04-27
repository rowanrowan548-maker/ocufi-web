'use client';

/**
 * T-927 #11/#1/#2/#10/#12 · Landing Hero 大 CA 搜索框 + 热门代币 chips
 *
 * - 中央超大搜索框(合约地址 / symbol),点击展开 TokenSearchCombo dropdown
 * - 选中 → 跳 /trade?mint=X(行为对齐 HeaderSearch)
 * - 下方 6-8 token chips,直接点跳交易页(让用户不连钱包也能立刻进入)
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TokenSearchCombo } from '@/components/common/token-search-combo';
import { fetchTokensInfoBatch, type TokenInfo } from '@/lib/portfolio';
import { PRESET_MAJORS, PRESET_MEME } from '@/lib/preset-tokens';

const CHIP_MINTS = [
  ...PRESET_MAJORS.slice(0, 4),  // SOL · JUP · JTO · PYTH
  ...PRESET_MEME.slice(0, 4),    // BONK · WIF · MEW · POPCAT
];

export function HeroCASearch() {
  const t = useTranslations('landing.hero');
  const router = useRouter();
  const [chips, setChips] = useState<TokenInfo[]>([]);

  useEffect(() => {
    fetchTokensInfoBatch(CHIP_MINTS)
      .then((map) => {
        const out: TokenInfo[] = [];
        // 保持 CHIP_MINTS 顺序(用户视觉:主流在前,meme 在后)
        for (const m of CHIP_MINTS) {
          const info = map.get(m);
          if (info) out.push(info);
        }
        setChips(out);
      })
      .catch(() => {});
  }, []);

  function handleSelect(mint: string) {
    router.push(`/trade?mint=${mint}`);
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="relative">
        <TokenSearchCombo
          value=""
          onSelect={handleSelect}
          renderTrigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="w-full inline-flex items-center gap-3 rounded-xl border border-border/50 bg-card/80 backdrop-blur px-4 sm:px-5 h-14 sm:h-16 text-left hover:border-primary/40 transition-colors shadow-lg"
            >
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 truncate text-sm sm:text-base text-muted-foreground">
                {t('searchPlaceholder')}
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[11px] rounded bg-background border border-border/40 text-muted-foreground/70 font-mono">
                ⌘K
              </kbd>
            </button>
          )}
        />
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mr-1">
            {t('hotTokens')}
          </span>
          {chips.map((tok) => (
            <Link
              key={tok.mint}
              href={`/trade?mint=${tok.mint}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 hover:border-primary/40 hover:bg-card px-2.5 py-1 transition-colors"
            >
              {tok.logoUri ? (
                <Image
                  src={tok.logoUri}
                  alt={tok.symbol}
                  width={16}
                  height={16}
                  className="rounded-full"
                  unoptimized
                />
              ) : (
                <div className="h-4 w-4 rounded-full bg-muted text-[8px] font-bold flex items-center justify-center">
                  {tok.symbol.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium">{tok.symbol}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
