'use client';

import { Card } from '@/components/ui/card';
import { LineChart } from 'lucide-react';
import type { TokenDetail } from '@/lib/token-info';

interface Props {
  detail: TokenDetail | null;
}

export function ChartCard({ detail }: Props) {
  if (!detail) {
    return (
      <Card className="h-[420px] sm:h-[480px] flex items-center justify-center">
        <div className="text-muted-foreground text-sm flex items-center gap-2">
          <LineChart className="h-4 w-4" />
          loading…
        </div>
      </Card>
    );
  }

  if (!detail.dexUrl) {
    return (
      <Card className="h-[420px] sm:h-[480px] flex flex-col items-center justify-center gap-2 text-center px-6">
        <LineChart className="h-10 w-10 text-muted-foreground/40" />
        <div className="text-sm font-medium text-muted-foreground">No chart available</div>
        <div className="text-xs text-muted-foreground/60">
          DexScreener has no pair data for this token yet.
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <iframe
        src={`${detail.dexUrl}?embed=1&theme=dark&trades=0&info=0`}
        className="w-full h-[420px] sm:h-[480px] border-0"
        title={`${detail.symbol} chart`}
        loading="lazy"
      />
    </Card>
  );
}
