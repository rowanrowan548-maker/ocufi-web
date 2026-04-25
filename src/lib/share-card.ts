/**
 * 交易晒单卡 · 客户端 Canvas 生图
 *
 * 输出 1200×675 PNG(Twitter card 1.91:1)
 *
 * 布局:
 *   ┌──────────────────────────────────┬──────────────────────────────┐
 *   │ Brand + BUY/SELL + symbol        │  Token logo(大圆)            │
 *   │ Amount / SOL / USD               │  24h 价格曲线 + 涨跌%        │
 *   ├──────────────────────────────────┴──────────────────────────────┤
 *   │ Powered by Ocufi · 0.2% fee     ocufi.io/?ref=xxxxxx            │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * 不依赖外部 lib;Logo 跨域失败用 symbol 圆形大字代替
 */

export interface ShareCardData {
  kind: 'buy' | 'sell';
  symbol: string;
  amount: number;
  solAmount: number;
  usdAmount?: number;
  logoUrl?: string;
  inviteCode: string;
  pnlPct?: number;
  /** 当前美元价 + 4 个时点变化 % · 用于右侧 24h 价格曲线 */
  priceUsd?: number;
  priceChange24h?: number;
  priceChange6h?: number;
  priceChange1h?: number;
  priceChange5m?: number;
}

const W = 1200;
const H = 675;

const COLORS = {
  bg: '#0A0B0D',
  bg2: '#0F1115',
  accent: '#19FB9B',
  accentDim: 'rgba(25,251,155,0.15)',
  danger: '#EF4444',
  dangerDim: 'rgba(239,68,68,0.15)',
  fg: '#fafafa',
  muted: '#a1a1aa',
  dim: '#71717a',
  grid: 'rgba(255,255,255,0.04)',
};

export async function buildTradeCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // ── 背景:深色 + 微网格 + 左上品牌色径向光 ──
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // 网格
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  // 左上品牌径向光
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 700);
  grad.addColorStop(0, 'rgba(25,251,155,0.13)');
  grad.addColorStop(0.6, 'rgba(25,251,155,0.04)');
  grad.addColorStop(1, 'rgba(25,251,155,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 右下副色径向光(轻)
  const grad2 = ctx.createRadialGradient(W, H, 0, W, H, 600);
  const isBuy = data.kind === 'buy';
  grad2.addColorStop(0, isBuy ? 'rgba(25,251,155,0.06)' : 'rgba(239,68,68,0.06)');
  grad2.addColorStop(1, 'transparent');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, W, H);

  // ── 顶部品牌锁层 · Logo (绿) + Wordmark (白) ──
  drawBrandLockup(ctx, 60, 100, {
    wordmark: 'OCUFI',
    subtitle: 'Solana · Non-custodial · 0.2% fee',
  });

  // 右上角社交账号
  drawSocials(ctx, W - 60, 110);

  // ── 左侧:交易信息 ──
  // BUY/SELL 大徽章
  const badgeColor = isBuy ? COLORS.accent : COLORS.danger;
  const badgeText = isBuy ? 'BOUGHT' : 'SOLD';
  ctx.fillStyle = badgeColor;
  roundRect(ctx, 60, 215, 170, 56, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.bg;
  ctx.font = 'bold 26px ui-sans-serif, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, 145, 244);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Symbol 大字(在徽章右边)
  ctx.fillStyle = COLORS.fg;
  ctx.font = 'bold 52px ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  const sym = `$${truncate(data.symbol, 12)}`;
  ctx.fillText(sym, 250, 257);

  // 数量(symbol 单位)
  ctx.fillStyle = COLORS.muted;
  ctx.font = '24px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText(
    `${formatNumber(data.amount)} ${truncate(data.symbol, 10)}`,
    60,
    340,
  );

  // SOL 大字
  ctx.fillStyle = COLORS.fg;
  ctx.font = 'bold 56px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText(`${data.solAmount.toFixed(4)} SOL`, 60, 410);

  // USD
  if (data.usdAmount && data.usdAmount > 0) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '22px ui-monospace, monospace';
    ctx.fillText(`≈ $${data.usdAmount.toFixed(2)} USD`, 60, 446);
  }

  // PnL(卖出且有数据)
  if (data.kind === 'sell' && data.pnlPct != null && Number.isFinite(data.pnlPct)) {
    const pnlColor = data.pnlPct >= 0 ? COLORS.accent : COLORS.danger;
    const sign = data.pnlPct >= 0 ? '+' : '';
    ctx.fillStyle = pnlColor;
    ctx.font = 'bold 64px ui-monospace, monospace';
    ctx.fillText(`${sign}${data.pnlPct.toFixed(2)}%`, 60, 525);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '16px ui-sans-serif, sans-serif';
    ctx.fillText('realized P/L', 60, 548);
  }

  // ── 右侧:Logo + 价格曲线 ──
  const RIGHT_X = 660;
  const RIGHT_W = W - RIGHT_X - 60;  // 480
  const LOGO_R = 70;
  const LOGO_CX = RIGHT_X + RIGHT_W / 2;
  const LOGO_CY = 230;

  // Logo 圆形容器(光晕)
  const logoGlow = ctx.createRadialGradient(LOGO_CX, LOGO_CY, LOGO_R, LOGO_CX, LOGO_CY, LOGO_R + 60);
  logoGlow.addColorStop(0, 'rgba(25,251,155,0.18)');
  logoGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = logoGlow;
  ctx.fillRect(RIGHT_X - 40, LOGO_CY - LOGO_R - 80, RIGHT_W + 80, LOGO_R * 2 + 160);

  // 实际 logo
  let logoOk = false;
  if (data.logoUrl) {
    try {
      const img = await loadImage(data.logoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(LOGO_CX, LOGO_CY, LOGO_R, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, LOGO_CX - LOGO_R, LOGO_CY - LOGO_R, LOGO_R * 2, LOGO_R * 2);
      ctx.restore();
      logoOk = true;
    } catch { /* fallback: 大字 symbol */ }
  }

  if (!logoOk) {
    // Fallback:用 symbol 头两位做大字 logo
    ctx.fillStyle = COLORS.bg2;
    ctx.beginPath();
    ctx.arc(LOGO_CX, LOGO_CY, LOGO_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 56px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.symbol.slice(0, 2).toUpperCase(), LOGO_CX, LOGO_CY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Logo 圆形边框
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(LOGO_CX, LOGO_CY, LOGO_R, 0, Math.PI * 2);
  ctx.stroke();

  // 当前价(logo 下方)
  if (data.priceUsd && data.priceUsd > 0) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '14px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CURRENT PRICE', LOGO_CX, LOGO_CY + LOGO_R + 28);
    ctx.fillStyle = COLORS.fg;
    ctx.font = 'bold 32px ui-monospace, monospace';
    ctx.fillText(formatPrice(data.priceUsd), LOGO_CX, LOGO_CY + LOGO_R + 60);
    ctx.textAlign = 'left';
  }

  // 24h 涨跌 + sparkline · 卡片底部
  drawSparkline(ctx, data, {
    x: RIGHT_X,
    y: 410,
    w: RIGHT_W,
    h: 130,
  });

  // ── 底部水印 ──
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 605);
  ctx.lineTo(W - 60, 605);
  ctx.stroke();

  ctx.fillStyle = COLORS.dim;
  ctx.font = '17px ui-sans-serif, sans-serif';
  ctx.fillText('Powered by Ocufi · open-source · audit-friendly', 60, 638);

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 22px ui-monospace, monospace';
  const inviteUrl = `ocufi.io/?ref=${data.inviteCode}`;
  const w = ctx.measureText(inviteUrl).width;
  ctx.fillText(inviteUrl, W - 60 - w, 638);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
      0.95,
    );
  });
}

function drawSparkline(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  rect: { x: number; y: number; w: number; h: number },
) {
  const { x, y, w, h } = rect;
  const cur = data.priceUsd ?? 0;
  if (cur <= 0) return;

  // 5 个锚点:24h/6h/1h/5m/now,不存在的字段当 0(无变化)
  const points = [
    priceFromPctChange(cur, data.priceChange24h),
    priceFromPctChange(cur, data.priceChange6h),
    priceFromPctChange(cur, data.priceChange1h),
    priceFromPctChange(cur, data.priceChange5m),
    cur,
  ];

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || max * 0.005 || 1;

  const padTop = 10, padBot = 32;
  const xs = points.map((_, i) => x + (i / (points.length - 1)) * w);
  const ys = points.map((p) => y + padTop + (1 - (p - min) / range) * (h - padTop - padBot));

  // 涨绿跌红
  const change24h = data.priceChange24h ?? 0;
  const up = change24h >= 0;
  const stroke = up ? COLORS.accent : COLORS.danger;

  // 渐变 area 填充
  const fillGrad = ctx.createLinearGradient(x, y, x, y + h);
  fillGrad.addColorStop(0, up ? 'rgba(25,251,155,0.35)' : 'rgba(239,68,68,0.35)');
  fillGrad.addColorStop(1, up ? 'rgba(25,251,155,0)' : 'rgba(239,68,68,0)');

  // 平滑曲线(每两点之间用 quadratic curve 中点法)
  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i < xs.length; i++) {
    const mx = (xs[i - 1] + xs[i]) / 2;
    const my = (ys[i - 1] + ys[i]) / 2;
    ctx.quadraticCurveTo(xs[i - 1], ys[i - 1], mx, my);
  }
  ctx.lineTo(xs[xs.length - 1], ys[ys.length - 1]);

  // area
  const areaPath = new Path2D();
  areaPath.moveTo(xs[0], ys[0]);
  for (let i = 1; i < xs.length; i++) {
    const mx = (xs[i - 1] + xs[i]) / 2;
    const my = (ys[i - 1] + ys[i]) / 2;
    areaPath.quadraticCurveTo(xs[i - 1], ys[i - 1], mx, my);
  }
  areaPath.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
  areaPath.lineTo(x + w, y + h - padBot);
  areaPath.lineTo(x, y + h - padBot);
  areaPath.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill(areaPath);

  // line
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 末点高亮
  const lastX = xs[xs.length - 1];
  const lastY = ys[ys.length - 1];
  ctx.fillStyle = stroke;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fill();

  // 底部时间标记 + 24h 涨跌大字
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px ui-monospace, monospace';
  ctx.fillText('-24h', x, y + h - 10);
  ctx.textAlign = 'right';
  ctx.fillText('NOW', x + w, y + h - 10);
  ctx.textAlign = 'left';

  // 24h 涨跌徽章(右上角)
  if (Math.abs(change24h) > 0.001) {
    const sign = change24h >= 0 ? '+' : '';
    const text = `${sign}${change24h.toFixed(2)}% 24H`;
    ctx.font = 'bold 18px ui-monospace, monospace';
    const tw = ctx.measureText(text).width;
    const bx = x + w - tw - 16;
    const by = y + 4;
    const bh = 28;
    ctx.fillStyle = up ? 'rgba(25,251,155,0.18)' : 'rgba(239,68,68,0.18)';
    roundRect(ctx, bx - 8, by, tw + 16, bh, 6);
    ctx.fill();
    ctx.fillStyle = up ? COLORS.accent : COLORS.danger;
    ctx.fillText(text, bx, by + 20);
  }
}

function priceFromPctChange(currentPrice: number, pctChange?: number): number {
  if (pctChange == null || !Number.isFinite(pctChange)) return currentPrice;
  return currentPrice / (1 + pctChange / 100);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
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

function formatPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  if (n >= 0.0001) return '$' + n.toFixed(6);
  return '$' + n.toPrecision(3);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

/**
 * 品牌锁层 = Logo + OCUFI 字标 + 副标
 *
 * 视觉规则(参考 Linear / Vercel):
 *  - Logo 尺寸 = OCUFI 字母 cap 高度,视觉重心一致
 *  - Logo 用品牌色,Wordmark 用白色 — 更高级,不抢戏
 *  - 副标小字灰色,挂在 wordmark 正下方
 *
 * @param x 锁层左上 x
 * @param baselineY OCUFI 文字 baseline 的 y(其他元素围绕这个对齐)
 */
export function drawBrandLockup(
  ctx: CanvasRenderingContext2D,
  x: number,
  baselineY: number,
  opts: { wordmark: string; subtitle: string },
) {
  const FONT_SIZE = 45;
  const LOGO_SIZE = 45;
  const GAP = 14;

  // OCUFI 字母 cap 中心 ≈ baseline 上方 0.35×fontSize
  const capCenterY = baselineY - FONT_SIZE * 0.35;
  // Logo 顶部 y 让其视觉中心(LOGO_SIZE/2)对准 cap 中心
  const logoY = capCenterY - LOGO_SIZE / 2;

  drawBrandLogo(ctx, x, logoY, LOGO_SIZE);

  // Wordmark · 白色,字间距紧
  ctx.fillStyle = COLORS.fg;
  ctx.font = `bold ${FONT_SIZE}px ui-sans-serif, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const textX = x + LOGO_SIZE + GAP;
  ctx.fillText(opts.wordmark, textX, baselineY);

  // 副标 · muted gray monospace,在 wordmark 下方
  ctx.fillStyle = COLORS.muted;
  ctx.font = '15px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText(opts.subtitle, textX, baselineY + 26);
}

/** Arc O logo · Canvas 版 · anchor 在左上角 (x, y),size 是边长 */
export function drawBrandLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const scale = size / 32;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = 11 * scale;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.8 * scale;
  ctx.strokeStyle = COLORS.accent;

  // 实色弧 · 上右 (从 12 点到 3 点)
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, 0);
  ctx.stroke();

  // 实色弧 · 下左(从 6 点到 9 点)
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI / 2, Math.PI);
  ctx.stroke();

  // 淡色弧 · 下右
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI / 2);
  ctx.stroke();

  // 淡色弧 · 上左
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, -Math.PI / 2);
  ctx.stroke();

  // 中心瞳点
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** 卡片右上角:𝕏 @Ocufi_io · ocufi.io 字符串 · anchor 在 (rightX, baseY) */
export function drawSocials(
  ctx: CanvasRenderingContext2D,
  rightX: number,
  baseY: number,
) {
  const handle = '@Ocufi_io';
  const domain = 'ocufi.io';

  ctx.font = '16px ui-sans-serif, sans-serif';
  ctx.fillStyle = COLORS.muted;

  // 先量度:domain 在最右,handle 在它左边,再加分隔点
  const domainW = ctx.measureText(domain).width;
  const sepW = ctx.measureText(' · ').width;
  ctx.font = 'bold 16px ui-sans-serif, sans-serif';
  const handleW = ctx.measureText('𝕏 ').width + ctx.measureText(handle).width;

  const totalW = handleW + sepW + domainW;
  const x0 = rightX - totalW;

  // 𝕏 + handle
  ctx.fillStyle = COLORS.fg;
  ctx.font = 'bold 16px ui-sans-serif, sans-serif';
  ctx.fillText('𝕏 ', x0, baseY);
  const xAfterIcon = x0 + ctx.measureText('𝕏 ').width;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(handle, xAfterIcon, baseY);

  // 分隔点
  ctx.fillStyle = COLORS.dim;
  ctx.font = '16px ui-sans-serif, sans-serif';
  ctx.fillText(' · ', x0 + handleW, baseY);

  // domain
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 16px ui-sans-serif, sans-serif';
  ctx.fillText(domain, x0 + handleW + sepW, baseY);
}
