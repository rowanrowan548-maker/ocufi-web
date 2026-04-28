/**
 * T-980-117 · /docs 章节配图组件
 *
 * 给定 src 时显图(screenshots/.png 或 gifs/.gif)· 缺素材时显占位
 * 服务端可渲染(无 hooks 无 state)
 */
import Image from 'next/image';
import { ImageIcon } from 'lucide-react';

interface Props {
  /** 路径相对 /public · 例 "/docs/screenshots/connect.png" 或 "/docs/gifs/buy.gif" */
  src?: string;
  alt: string;
  caption?: string;
  /** 默认 16/9 · GIF 录制建议 */
  aspect?: '16/9' | '4/3' | '1/1' | '3/2';
  /** 占位文案(缺素材时)· 默认 "截图待补" */
  placeholderHint?: string;
}

export function DocImagePlaceholder({
  src,
  alt,
  caption,
  aspect = '16/9',
  placeholderHint,
}: Props) {
  const aspectClass = aspect === '16/9' ? 'aspect-video'
    : aspect === '4/3' ? 'aspect-[4/3]'
      : aspect === '1/1' ? 'aspect-square'
        : 'aspect-[3/2]';

  return (
    <figure className="space-y-1.5">
      <div className={`${aspectClass} rounded-md border border-border/40 bg-muted/20 overflow-hidden relative`}>
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            unoptimized={src.endsWith('.gif')}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground/50">
            <ImageIcon className="h-6 w-6" aria-hidden="true" />
            <span className="text-[11px] tracking-wide">{placeholderHint ?? alt}</span>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="text-[11px] text-muted-foreground/70 text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
