/**
 * T-965 #167 · 通用 shimmer skeleton 占位
 * 用法:<Skeleton className="h-4 w-32" />
 */
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/60',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** 表格行 skeleton · 给 list 用 */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2 w-16" />
      </div>
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-12 hidden sm:block" />
      ))}
    </div>
  );
}
