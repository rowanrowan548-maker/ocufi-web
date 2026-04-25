/**
 * 交易晒单卡 · 客户端 Canvas 生图
 *
 * 输出 1200×675 PNG(Twitter card 1.91:1)· 品牌色 + 邀请码水印
 *
 * 不依赖外部 lib,纯 Canvas API。Logo 跨域加载失败自动跳过(用 symbol 大字代替)
 */

export interface ShareCardData {
  kind: 'buy' | 'sell';
  symbol: string;
  /** token 数量 */
  amount: number;
  /** 配对的 SOL 数(买入花的 / 卖出收到的) */
  solAmount: number;
  /** 折合 USD,可选 */
  usdAmount?: number;
  /** logo URL,可选(跨域失败会跳过) */
  logoUrl?: string;
  /** 邀请码,水印用 */
  inviteCode: string;
  /** 卖出的盈亏 %,可选 */
  pnlPct?: number;
}

const W = 1200;
const H = 675;

const COLORS = {
  bg: '#0A0B0D',
  accent: '#19FB9B',
  danger: '#EF4444',
  fg: '#fafafa',
  muted: '#a1a1aa',
  dim: '#71717a',
};

export async function buildTradeCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // 背景
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // 顶部品牌色径向光
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 900);
  grad.addColorStop(0, 'rgba(25,251,155,0.10)');
  grad.addColorStop(1, 'rgba(25,251,155,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 角落装饰线
  ctx.strokeStyle = 'rgba(25,251,155,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 60);
  ctx.lineTo(180, 60);
  ctx.stroke();

  // 顶部 Ocufi 字标
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 36px ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('OCUFI', 60, 95);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '16px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText('Solana · Non-custodial', 60, 120);

  // Buy/Sell 大徽章
  const isBuy = data.kind === 'buy';
  const badgeColor = isBuy ? COLORS.accent : COLORS.danger;
  const badgeText = isBuy ? 'BOUGHT' : 'SOLD';
  ctx.fillStyle = badgeColor;
  roundRect(ctx, 60, 220, 160, 56, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.bg;
  ctx.font = 'bold 26px ui-sans-serif, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, 140, 248);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Token logo(可选 · 跨域失败跳过)
  let symbolX = 250;
  if (data.logoUrl) {
    try {
      const img = await loadImage(data.logoUrl);
      const cx = 290, cy = 248, r = 32;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
      symbolX = 340;
    } catch { /* logo 加载失败,跳过 */ }
  }

  // Token symbol 大字
  ctx.fillStyle = COLORS.fg;
  ctx.font = 'bold 48px ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  const sym = `$${truncate(data.symbol, 12)}`;
  ctx.fillText(sym, symbolX, 260);

  // 数量 + SOL
  ctx.fillStyle = COLORS.muted;
  ctx.font = '28px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText(
    `${formatNumber(data.amount)} ${truncate(data.symbol, 10)}`,
    60,
    360,
  );

  ctx.fillStyle = COLORS.fg;
  ctx.font = 'bold 56px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText(`${data.solAmount.toFixed(4)} SOL`, 60, 432);

  if (data.usdAmount && data.usdAmount > 0) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '22px ui-monospace, monospace';
    ctx.fillText(`≈ $${data.usdAmount.toFixed(2)} USD`, 60, 470);
  }

  // PnL(卖出 only · 可选)
  if (data.kind === 'sell' && data.pnlPct != null && Number.isFinite(data.pnlPct)) {
    const pnlColor = data.pnlPct >= 0 ? COLORS.accent : COLORS.danger;
    const sign = data.pnlPct >= 0 ? '+' : '';
    ctx.fillStyle = pnlColor;
    ctx.font = 'bold 64px ui-monospace, monospace';
    ctx.fillText(`${sign}${data.pnlPct.toFixed(2)}%`, 60, 545);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '18px ui-sans-serif, sans-serif';
    ctx.fillText('realized', 60, 570);
  }

  // 底部水印
  // 分隔线
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 600);
  ctx.lineTo(W - 60, 600);
  ctx.stroke();

  ctx.fillStyle = COLORS.dim;
  ctx.font = '18px ui-sans-serif, sans-serif';
  ctx.fillText('Powered by Ocufi · 0.2% fee · open-source', 60, 633);

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 22px ui-monospace, monospace';
  const inviteUrl = `ocufi.io/?ref=${data.inviteCode}`;
  // 右下角对齐
  const w = ctx.measureText(inviteUrl).width;
  ctx.fillText(inviteUrl, W - 60 - w, 633);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
      0.95,
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    // 5s 内不下来就放弃
    setTimeout(() => reject(new Error('image timeout')), 5_000);
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(6);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
