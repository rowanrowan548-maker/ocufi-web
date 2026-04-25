/**
 * 战绩 / 总盈亏分享卡 · 1200×675 PNG
 *
 * 用户从持仓页一键生成,展示:
 *  - 累计盈亏(USD)大字
 *  - 已实现 / 未实现 / 胜率(W/L)
 *  - 钱包脱敏 + 邀请码 box
 *  - 右半:抽象品牌图形(同心圆 + 渐变光晕)
 *  - 右上 @Ocufi_io · ocufi.io 强化品牌
 */
import { drawSocials, drawBrandLockup } from './share-card';

const W = 1200;
const H = 675;

const COLORS = {
  bg: '#0A0B0D',
  bg2: '#0F1115',
  accent: '#19FB9B',
  danger: '#EF4444',
  fg: '#fafafa',
  muted: '#a1a1aa',
  dim: '#71717a',
  grid: 'rgba(255,255,255,0.04)',
};

export interface PnlShareCardData {
  walletAddress: string;
  inviteCode: string;
  realizedUsd: number;
  unrealizedUsd: number;
  totalUsd: number;
  totalPct: number;
  /** 平仓盈利笔数 */
  winCount: number;
  /** 平仓总笔数 */
  closedCount: number;
  /** 时间范围标签:7D / 30D / All-time 等 */
  rangeLabel: string;
}

export async function buildPnlShareCard(data: PnlShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // ── 背景 ──
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
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 800);
  grad.addColorStop(0, 'rgba(25,251,155,0.13)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 右下副色光(总盈亏正负决定)
  const isUp = data.totalUsd >= 0;
  const grad2 = ctx.createRadialGradient(W, H / 2, 0, W, H / 2, 700);
  grad2.addColorStop(0, isUp ? 'rgba(25,251,155,0.10)' : 'rgba(239,68,68,0.10)');
  grad2.addColorStop(1, 'transparent');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, W, H);

  // ── 顶部品牌锁层 · Logo (绿) + Wordmark (白) ──
  drawBrandLockup(ctx, 60, 100, {
    wordmark: 'OCUFI',
    subtitle: 'Solana · Non-custodial · Open-source',
  });

  // 右上社交账号
  drawSocials(ctx, W - 60, 110);

  // ── 左侧:数据 ──
  // Range label
  ctx.fillStyle = COLORS.muted;
  ctx.font = '24px ui-sans-serif, sans-serif';
  ctx.fillText(`${data.rangeLabel} 累计盈亏`, 60, 220);

  // 总盈亏徽章 · 大字
  const sign = data.totalUsd >= 0 ? '+' : '';
  const totalText = `${sign}$${formatUsd(Math.abs(data.totalUsd))}`;
  // 一次性设好字体后量度,避免量度时和绘制时字体不一致导致错位
  ctx.font = 'bold 80px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const tw = ctx.measureText(totalText).width;

  // 实心徽章
  const badgeX = 60;
  const badgeY = 240;
  const badgeH = 100;
  const badgeW = tw + 48;
  const badgeColor = isUp ? COLORS.accent : COLORS.danger;
  ctx.fillStyle = badgeColor;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fill();

  // 文字垂直居中:用 alphabetic baseline + 偏移,避免不同字体 middle baseline 不一致
  ctx.fillStyle = COLORS.bg;
  ctx.font = 'bold 80px ui-monospace, "SF Mono", Menlo, monospace';
  // alphabetic baseline 通常在文字下边缘上方约 0.2em 处;80px × ~0.7 = 56 看起来居中
  const textY = badgeY + badgeH / 2 + 28;
  ctx.fillText(totalText, badgeX + 24, textY);

  // 总涨幅 %(徽章下方)
  if (Number.isFinite(data.totalPct)) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '22px ui-monospace, monospace';
    const pctSign = data.totalPct >= 0 ? '+' : '';
    ctx.fillText(`${pctSign}${data.totalPct.toFixed(2)}% ${data.rangeLabel}`, 60, 376);
  }

  // 细分:已实现 / 未实现 / 胜率
  let rowY = 432;
  drawStatRow(ctx, '已实现', formatPnl(data.realizedUsd), pnlColor(data.realizedUsd), rowY);
  rowY += 56;
  drawStatRow(ctx, '未实现', formatPnl(data.unrealizedUsd), pnlColor(data.unrealizedUsd), rowY);
  rowY += 56;
  // 胜率显示 W/L 样式 + 百分比
  const winRate = data.closedCount > 0 ? (data.winCount / data.closedCount) * 100 : 0;
  const wlText = `${data.winCount}/${data.closedCount}`;
  drawStatRow(
    ctx,
    '胜率',
    `${wlText}  (${winRate.toFixed(0)}%)`,
    data.closedCount > 0 ? COLORS.fg : COLORS.muted,
    rowY,
  );

  // ── 右侧:抽象品牌图形 ──
  drawAbstractGraphic(ctx, isUp);

  // 钱包脱敏 + 邀请码(右下,gmgn 风)
  drawWalletAndInvite(ctx, data);

  // ── 底部水印 ──
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 605);
  ctx.lineTo(W - 60, 605);
  ctx.stroke();

  ctx.fillStyle = COLORS.dim;
  ctx.font = '20px ui-sans-serif, sans-serif';
  ctx.fillText('Powered by Ocufi · open-source · audit-friendly', 60, 640);

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 25px ui-monospace, monospace';
  const inviteUrl = `ocufi.io/?ref=${data.inviteCode}`;
  const w = ctx.measureText(inviteUrl).width;
  ctx.fillText(inviteUrl, W - 60 - w, 640);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
      0.95,
    );
  });
}

function drawStatRow(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  valueColor: string,
  y: number,
) {
  ctx.fillStyle = COLORS.muted;
  ctx.font = '24px ui-sans-serif, sans-serif';
  ctx.fillText(label, 60, y);

  ctx.fillStyle = valueColor;
  ctx.font = 'bold 34px ui-monospace, monospace';
  ctx.fillText(value, 240, y);
}

function drawAbstractGraphic(ctx: CanvasRenderingContext2D, isUp: boolean) {
  const cx = 950;
  const cy = 320;
  const baseColor = isUp ? '25,251,155' : '239,68,68';

  // 同心圆环
  for (let i = 6; i >= 1; i--) {
    const r = i * 40;
    const alpha = 0.04 + (6 - i) * 0.025;
    ctx.strokeStyle = `rgba(${baseColor},${alpha})`;
    ctx.lineWidth = i === 1 ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 中心 dot 光晕
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
  glow.addColorStop(0, `rgba(${baseColor},0.4)`);
  glow.addColorStop(1, `rgba(${baseColor},0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI * 2);
  ctx.fill();

  // 中心实心 dot
  ctx.fillStyle = `rgba(${baseColor},0.9)`;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();

  // 几个轨道粒子
  const orbits = [
    { angle: 0.2, r: 80, size: 5 },
    { angle: 1.6, r: 120, size: 4 },
    { angle: 3.0, r: 160, size: 6 },
    { angle: 4.5, r: 200, size: 4 },
    { angle: 5.8, r: 240, size: 3 },
  ];
  for (const o of orbits) {
    const px = cx + o.r * Math.cos(o.angle);
    const py = cy + o.r * Math.sin(o.angle);
    ctx.fillStyle = `rgba(${baseColor},0.7)`;
    ctx.beginPath();
    ctx.arc(px, py, o.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWalletAndInvite(ctx: CanvasRenderingContext2D, data: PnlShareCardData) {
  const rightX = W - 60;
  const masked =
    data.walletAddress.length > 8
      ? `${data.walletAddress.slice(0, 4)}…${data.walletAddress.slice(-4)}`
      : data.walletAddress;

  // ── 钱包 pill(头像点 + 脱敏地址 + 半透明背景) ──
  ctx.font = 'bold 22px ui-monospace, "SF Mono", Menlo, monospace';
  const walletTextW = ctx.measureText(masked).width;
  const dotR = 11;
  const padX = 16;
  const pillH = 44;
  const pillW = dotR * 2 + 10 + walletTextW + padX * 2;
  const pillX = rightX - pillW;
  const pillY = 480;

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 头像圆点
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(pillX + padX + dotR, pillY + pillH / 2, dotR, 0, Math.PI * 2);
  ctx.fill();

  // 脱敏地址
  ctx.fillStyle = COLORS.fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(masked, pillX + padX + dotR * 2 + 10, pillY + pillH / 2);
  ctx.textBaseline = 'alphabetic';

  // ── 邀请码(右对齐,labels + code 一行,无重叠) ──
  const codeY = pillY + pillH + 36;
  const codeLabel = '邀请码 ';
  ctx.font = '18px ui-sans-serif, sans-serif';
  const labelW = ctx.measureText(codeLabel).width;
  ctx.font = 'bold 22px ui-monospace, monospace';
  const codeW = ctx.measureText(data.inviteCode).width;
  const totalW = labelW + codeW;
  const startX = rightX - totalW;

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.muted;
  ctx.font = '18px ui-sans-serif, sans-serif';
  ctx.fillText(codeLabel, startX, codeY);
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 22px ui-monospace, monospace';
  ctx.fillText(data.inviteCode, startX + labelW, codeY);
}

function pnlColor(usd: number): string {
  if (usd > 0) return COLORS.accent;
  if (usd < 0) return COLORS.danger;
  return COLORS.muted;
}

function formatPnl(usd: number): string {
  const sign = usd > 0 ? '+' : usd < 0 ? '-' : '';
  return `${sign}$${formatUsd(Math.abs(usd))}`;
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
