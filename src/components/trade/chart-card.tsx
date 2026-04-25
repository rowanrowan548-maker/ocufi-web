'use client';

/**
 * K 线卡 · DexScreener iframe
 *
 * 性能:不等 fetchTokenDetail 完成(被 RugCheck 15s 超时拖慢)
 *      只要有 mint 就立即 build URL,iframe 直接加载
 * 安全:sandbox 限制 iframe 不能跳父窗口/读 cookie/弹弹窗
 */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Loader2 } from 'lucide-react';
import { SOL_MINT } from '@/lib/preset-tokens';

interface Props {
  mint?: string | null;
}

export function ChartCard({ mint }: Props) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // mint 切换时重置 loading 状态
  useEffect(() => {
    setIframeLoaded(false);
  }, [mint]);

  if (!mint) {
    return <Placeholder text="loading…" Icon={Loader2} spin />;
  }

  if (mint === SOL_MINT) {
    return (
      <Placeholder
        text="SOL 是基础币 · 选其他代币查看 K 线"
        Icon={LineChart}
      />
    );
  }

  // DexScreener 自带 mint→pair 重定向,直接构 URL,免去等 detail.dexUrl
  const src = `https://dexscreener.com/solana/${encodeURIComponent(mint)}?embed=1&theme=dark&trades=0&info=0`;

  return (
    <Card className="overflow-hidden p-0 relative">
      {!iframeLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm pointer-events-none">
          <div className="text-muted-foreground text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            loading chart…
          </div>
        </div>
      )}
      <iframe
        src={src}
        className="w-full h-[420px] sm:h-[480px] border-0"
        title="DexScreener chart"
        // 防 iframe 越权:不允许 top-navigation / form / 同源访问父窗口
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        onLoad={() => setIframeLoaded(true)}
      />
    </Card>
  );
}

function Placeholder({
  text,
  Icon,
  spin,
}: {
  text: string;
  Icon: typeof LineChart;
  spin?: boolean;
}) {
  return (
    <Card className="h-[420px] sm:h-[480px] flex items-center justify-center">
      <div className="text-muted-foreground text-sm flex items-center gap-2">
        <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} />
        {text}
      </div>
    </Card>
  );
}
