import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * T-FE-MOBILE-RESCUE-P0 · /rewards 移动端 class 防回归
 *
 * /rewards 三个 tab 子组件用了 next-intl + base-ui Tabs · render 测试需要 Provider 全套
 * setup · 投资回报低。改成"读源文件 + grep 关键 class"的静态防御 · 同样能挡住
 * 无意改回 desktop-only 的 PR。
 *
 * 防御点(任一被删都炸测试):
 *   - rewards-screen.tsx  · TabsList 必须 h-12 md:h-9(48 → 36)
 *   - reclaim-tab.tsx      · li 必须 min-h-14(≥ 56px touch)+ checkbox h-5
 *   - mev-history-tab.tsx · li 必须 min-h-14
 *   - invite-redirect-tab.tsx · CTA 必须 h-12 sm:h-10 + w-full sm:w-auto
 */

function read(rel: string): string {
  return readFileSync(join(__dirname, '..', rel), 'utf8');
}

describe('rewards-screen.tsx · TabsList 移动端高度', () => {
  const src = read('rewards-screen.tsx');
  it('TabsList 用 h-12 md:h-9(48 → 36 · iOS HIG 44+)', () => {
    expect(src).toMatch(/h-12 md:h-9/);
  });
  it('每个 TabsTrigger 字号 text-xs sm:text-sm(< 640 紧凑)', () => {
    const triggers = src.match(/TabsTrigger\b/g);
    expect(triggers?.length).toBeGreaterThanOrEqual(3);
    const matches = src.match(/className="text-xs sm:text-sm"/g);
    expect(matches?.length).toBe(3);
  });
  it('icon 用 h-4 w-4(从 h-3.5 升上来 · 触控辨识)', () => {
    expect(src).toMatch(/Recycle className="h-4 w-4"/);
    expect(src).toMatch(/Zap className="h-4 w-4"/);
    expect(src).toMatch(/UserPlus className="h-4 w-4"/);
  });
});

describe('reclaim-tab.tsx · 列表 item 触控热区', () => {
  const src = read('reclaim-tab.tsx');
  it('item li 必须 min-h-14(≥ 56px · 用户能稳点)', () => {
    expect(src).toMatch(/min-h-14/);
  });
  it('checkbox h-5 w-5 sm:h-4 sm:w-4(移动端大 · 桌面回常规)', () => {
    expect(src).toMatch(/h-5 w-5 sm:h-4 sm:w-4/);
  });
  it('item p-4 sm:p-3(移动端宽松)', () => {
    expect(src).toMatch(/p-4 sm:p-3/);
  });
});

describe('mev-history-tab.tsx · 列表 item 移动端字号', () => {
  const src = read('mev-history-tab.tsx');
  it('item li 必须 min-h-14', () => {
    expect(src).toMatch(/min-h-14/);
  });
  it('amount 字号 text-base sm:text-sm(移动端大)', () => {
    expect(src).toMatch(/text-base sm:text-sm/);
  });
});

describe('invite-redirect-tab.tsx · CTA 触控 + 全宽', () => {
  const src = read('invite-redirect-tab.tsx');
  it('CTA 高 h-12 sm:h-10(移动端 48px · 桌面 40px)', () => {
    expect(src).toMatch(/h-12 sm:h-10/);
  });
  it('CTA w-full sm:w-auto(移动端全宽)', () => {
    expect(src).toMatch(/w-full sm:w-auto/);
  });
});
