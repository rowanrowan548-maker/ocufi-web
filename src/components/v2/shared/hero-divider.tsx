/**
 * V2 Hero Divider · brand 渐变 1px 细线
 * 桌面 240px 宽 / mobile 全宽
 * 给 hero 标题下方 / OG 卡顶部呼应用
 */
type HeroDividerProps = { fullWidth?: boolean; marginY?: string };

export function HeroDivider({ fullWidth = false, marginY = '8px 0 32px' }: HeroDividerProps) {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        width: fullWidth ? '100%' : 240,
        background:
          'linear-gradient(90deg, var(--brand-up) 0%, rgba(25,251,155,0.4) 50%, transparent 100%)',
        margin: marginY,
        opacity: 0.7,
      }}
    />
  );
}
