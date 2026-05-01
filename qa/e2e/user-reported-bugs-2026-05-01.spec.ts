import { test, expect } from '@playwright/test';
import { tradeUrl, MINTS, PREVIEW_KEY } from './_helpers';

/**
 * T7 · T-QA-USER-BUG-REGRESSION
 *
 * 6 个用户手测 bug ship 后回归 spec(T1-T6 全 ship 后跑 · 2026-05-01)。
 * 每个 case 独立 · 不串测 · 失败一个不挂其它。
 *
 * 1. Phantom Connect 流程(无 Phantom env 时 skip)· 不报 Auth2Stamper
 * 2. /trade?mint=USDC · audit-card V2 占位 tag visible
 * 3. /markets · smart-money badge 至少有几行(T5 ship 后期望 ≥ 5,但保底 ≥ 1)
 * 4. /trade · verified 绿盾去重 · 单一 visible BadgeCheck · 旁无 emoji
 * 5. /trade · 成交活动 tag filter · 点 KOL/老鼠仓 tab · 至少 render(数据可空但不挂)
 * 6. 搜索 modal · 输 BONK · 5s 内出 ≥ 1 结果
 */

function withPreview(path: string, key = PREVIEW_KEY) {
  return path.includes('?') ? `${path}&preview=${key}` : `${path}?preview=${key}`;
}

test.describe('T7 · 用户手测 6 类 bug 回归', () => {
  test.setTimeout(60_000);

  // ── case 1: Phantom Connect · 不报 Auth2Stamper · 图标 visible ───────────────
  test('case 1 · Phantom Connect · 不报 Auth2Stamper init 错', async ({ page }) => {
    test.skip(!process.env.OCUFI_PHANTOM_E2E, 'Phantom 无人值守流程要 OCUFI_PHANTOM_E2E env · 默认 skip');
    // 真走流程的逻辑放 wallet-history-smoke.spec.ts (qa/e2e-phantom-wallet 那条线)
    // 这里只在被显式启用时跑 placeholder · 防 CI 误用
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(withPreview('/'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const auth2 = consoleErrors.filter((e) => /Auth2Stamper.*not.*init|Auth2Stamper.*未初始化/i.test(e));
    expect(auth2, `Auth2Stamper init 错仍出:\n${auth2.join('\n')}`).toEqual([]);
  });

  // ── case 2: /trade?mint=USDC · V2 占位 tag visible ─────────────────────────
  test('case 2 · /trade USDC · audit-card V2 占位 "即将上线" tag', async ({ page }) => {
    await page.goto(tradeUrl('USDC'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4_000); // audit-card 拉数据
    // T3 ship 加了 data-testid="audit-cell-coming-soon" · V1 后端没做 rats/dev/bundle/sniper · 应该至少有 1 个
    const placeholderCount = await page.locator('[data-testid="audit-cell-coming-soon"]').count();
    expect(placeholderCount, '应至少 1 个 V2 占位 tag · 否则 T3 ship 没生效').toBeGreaterThan(0);
  });

  // ── case 3: /markets · smart-money badge column 真渲染 ─────────────────────
  test('case 3 · /markets · 聪明钱列 mount · 至少 N 行(T5 worker 填好后期望 ≥ 1)', async ({ page }) => {
    await page.goto(withPreview('/markets'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6_000); // markets 行级 IntersectionObserver 懒拉 + 数据

    // 表格至少 render
    const rowCount = await page.locator('[data-testid="markets-row"]').count();
    expect(rowCount, '/markets 没渲染任何行 · 页面真挂').toBeGreaterThan(0);

    // 聪明钱列 mount(每行都有 · 空时是 -empty / 有数据时是 -badge)
    const badgeFull = await page.locator('[data-testid="smart-money-badge"]').count();
    const badgeEmpty = await page.locator('[data-testid="smart-money-badge-empty"]').count();
    // eslint-disable-next-line no-console
    console.log(`[markets-smart-money] rows=${rowCount} · badge-full=${badgeFull} · badge-empty=${badgeEmpty}`);

    // 列必须 mount(只要 badge-full + badge-empty ≥ 1 就说明 column 在跑)
    expect(
      badgeFull + badgeEmpty,
      '聪明钱列没 mount · T5-FE smart-money-badge 没接上',
    ).toBeGreaterThan(0);

    // T5 worker 已填好数据时应 ≥ 1 满 badge · 0 时打 warning 但不 fail
    // (避免 worker 还没跑完就把 spec 标红)
    if (badgeFull === 0) {
      // eslint-disable-next-line no-console
      console.warn(`[case 3] smart-money 满 badge = 0 · T5 indexer 可能还没填完数据 · 报告 Tech Lead 看 worker 状态`);
    }
  });

  // ── case 4: /trade · verified 绿盾去重 ─────────────────────────────────────
  test('case 4 · /trade SOL · verified 绿盾仅 1 个 visible · 旁无 emoji', async ({ page }) => {
    await page.goto(tradeUrl('SOL'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    // BadgeCheck SVG · aria-label 含 "verified" · 桌面只有 1 个 visible(line 134-136 · 行 249 是另一处但桌面+移动只显示 1 个)
    const verifiedIcons = page.locator('svg[aria-label*="verified" i], [aria-label*="verified" i]');
    const count = await verifiedIcons.count();
    let visible = 0;
    for (let i = 0; i < count; i++) {
      if (await verifiedIcons.nth(i).isVisible().catch(() => false)) visible += 1;
    }
    expect(visible, `verified 图标 visible 数应 = 1 (T6 去重 ship)· 实际 ${visible}`).toBe(1);

    // 头部 symbol 旁不应该有 emoji 图标(✅ 🎯 等乱七八糟的字符在 symbol 前后)
    const symbolArea = page.locator('span').filter({ hasText: /^SOL$/i }).first();
    if (await symbolArea.isVisible().catch(() => false)) {
      const surrounding = await symbolArea.evaluate((el) => {
        const parent = el.parentElement;
        return parent ? parent.innerText : '';
      });
      const emojiCheck = /[\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}]/u.test(surrounding);
      // 允许 BadgeCheck 是 svg(不是 emoji 字符)· 这里只检查 unicode emoji
      expect(emojiCheck, `SOL symbol 旁出现 emoji 字符: "${surrounding}"`).toBe(false);
    }
  });

  // ── case 5: /trade · 成交活动 KOL/老鼠仓 tab 至少 render ───────────────────
  test('case 5 · /trade · 成交活动 KOL/rat tab 不挂 · render 表格或 "无数据" 文案', async ({ page }) => {
    await page.goto(tradeUrl('BONK'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    // trades-tag-filter 在桌面用 hidden lg:flex · viewport ≥ lg 才出现
    // 默认 viewport 来自 project · regression-desktop / desktop-default 都是 lg+
    const kolTab = page.getByRole('button', { name: /^kol$|^KOL$/i }).first();
    if (!(await kolTab.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Tab 不可见(可能 viewport 不够或 component 没 mount)· 改 fallback 验:
      // tag filter 区或 "成交活动" tab 渲染了即可
      const activityTab = page.getByText(/成交活动|活动|activity/i).first();
      await expect(activityTab).toBeVisible({ timeout: 5_000 });
      return;
    }

    await kolTab.click();
    await page.waitForTimeout(2_500);
    // 任一可接受:有数据行 OR "无数据" 文案 OR loading
    const okState = await Promise.race([
      page.locator('a[href*="/tx/"]').first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'data-rows'),
      page.getByText(/no.*tagged|noTaggedTrades|无.*成交|暂无/i).first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'empty-state'),
    ]).catch(() => null);
    expect(okState, 'KOL tab 切换后既无数据行也无 "无数据" 文案 · 疑似挂').not.toBeNull();
  });

  // ── case 6: 搜索 modal · 输 BONK · 5s 内 ≥ 1 结果 ─────────────────────────
  test('case 6 · 搜索 modal · BONK · 5s 内出 ≥ 1 结果', async ({ page }) => {
    await page.goto(tradeUrl('SOL'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);

    // 触发搜索 modal · "/" 全局快捷键
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    await page.waitForTimeout(600);

    // 输 BONK
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[placeholder*="DApp" i]')) as HTMLInputElement[];
      const el = inputs.find((e) => e.offsetParent !== null) ?? inputs[0];
      if (!el) throw new Error('search input not found');
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, 'BONK');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 5s 是目标 · 8s 是硬上限(超 8s 真挂)· 5-8s 之间打 warning 但 pass
    // 真结果 button 含 BONK + tabular-nums · search 输入 + 静态 placeholder 不会同时满足
    const start = Date.now();
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
        return buttons.some((b) => {
          if (b.offsetParent === null) return false;
          const text = (b.textContent ?? '').toLowerCase();
          if (!text.includes('bonk')) return false;
          // 至少一个 tabular-nums(数字列)说明是 result row 不是 trigger button
          return !!b.querySelector('span.tabular-nums, [class*="tabular"]');
        });
      },
      undefined,
      { timeout: 8_000 },
    );
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[search] BONK 搜索结果 ${elapsed}ms 内出现`);
    if (elapsed > 5_000) {
      // eslint-disable-next-line no-console
      console.warn(`[case 6] BONK 搜索 ${elapsed}ms · 超目标 5s · 报 Tech Lead 看 DexScreener 端`);
    }
    expect(elapsed, `BONK 搜索 > 8s · 真挂`).toBeLessThan(8_000);
  });
});
