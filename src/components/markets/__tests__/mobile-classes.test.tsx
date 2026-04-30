import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * T-FE-MOBILE-RESCUE-P0 · /markets 移动端 class 防回归
 *
 * /markets 也用了 next-intl + useEffect/setInterval · 完整 render 测试要 mock 一堆东西
 * 这里走 grep 静态防御 · 跟 /rewards 同模式
 *
 * 防御点(任一被删都炸测试):
 *   - markets-screen.tsx · 6 tab 必须 py-2 min-h-10 + flex-wrap(防 6 tab 横滚)
 *   - markets-table.tsx  · 必须双轨:MarketsCardsMobile + hidden md:block 表格
 */

function read(rel: string): string {
  return readFileSync(join(__dirname, '..', rel), 'utf8');
}

describe('markets-screen.tsx · tab 触控 + flex-wrap', () => {
  const src = read('markets-screen.tsx');
  it('tab 容器必须 flex-wrap(6 tab 在 393 viewport 一行装不下)', () => {
    expect(src).toMatch(/flex flex-wrap/);
  });
  it('每个 tab button 必须 py-2 + min-h-10(≥ 40px · 接近 iOS HIG 44+)', () => {
    expect(src).toMatch(/px-3 py-2 min-h-10/);
  });
  it('tab icon h-4 w-4(从 h-3.5 升上来 · 触控辨识)', () => {
    expect(src).toMatch(/Icon className="h-4 w-4"/);
  });
});

describe('markets-table.tsx · 双轨 · 表格不能裸跑', () => {
  const src = read('markets-table.tsx');
  it('必须 import MarketsCardsMobile', () => {
    expect(src).toMatch(/import \{ MarketsCardsMobile \}/);
  });
  it('必须渲染 <MarketsCardsMobile> 实例', () => {
    expect(src).toMatch(/<MarketsCardsMobile\b/);
  });
  it('Table 父 div 必须 hidden md:block(< md 不显示表格)', () => {
    expect(src).toMatch(/hidden md:block/);
  });
});
