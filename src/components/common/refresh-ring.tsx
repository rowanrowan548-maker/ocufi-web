/**
 * 倒计时圆环
 * 用 SVG circle dashoffset 做进度,中心显示秒数
 */
interface Props {
  /** 当前剩余秒 */
  remaining: number;
  /** 总秒数(circle 完整 = 0/total) */
  total: number;
  size?: number;
  /** 加载中(转圈) */
  loading?: boolean;
}

export function RefreshRing({ remaining, total, size = 24, loading }: Props) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className={loading ? 'animate-spin' : ''}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* 底圈 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={stroke}
          fill="none"
        />
        {/* 进度 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={loading ? c * 0.75 : c * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: loading ? 'none' : 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      {!loading && (
        <span className="absolute text-[9px] font-mono font-medium tabular-nums">
          {remaining}
        </span>
      )}
    </div>
  );
}
