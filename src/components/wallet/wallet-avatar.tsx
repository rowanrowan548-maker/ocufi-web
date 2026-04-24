/**
 * 钱包地址生成的 deterministic 渐变头像
 * 同一个地址永远是同一个颜色组合,无依赖
 */
interface Props {
  address: string;
  size?: number;
  className?: string;
}

function hashHue(s: string, salt = 0): number {
  let h = salt;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function WalletAvatar({ address, size = 22, className = '' }: Props) {
  if (!address) {
    return (
      <div
        className={`rounded-full bg-muted flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const h1 = hashHue(address, 7);
  const h2 = hashHue(address, 41);
  const h3 = hashHue(address, 113);
  return (
    <div
      className={`rounded-full flex-shrink-0 ring-1 ring-border/40 ${className}`}
      style={{
        width: size,
        height: size,
        background: `
          radial-gradient(circle at 30% 30%, hsl(${h1} 80% 65%) 0%, transparent 60%),
          radial-gradient(circle at 75% 70%, hsl(${h2} 75% 55%) 0%, transparent 65%),
          linear-gradient(135deg, hsl(${h3} 65% 50%), hsl(${(h1 + 180) % 360} 70% 40%))
        `,
      }}
      aria-label={`Avatar for ${address.slice(0, 4)}`}
    />
  );
}
