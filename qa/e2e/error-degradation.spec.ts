import { test, expect, type Page, type Route } from '@playwright/test';
import { tradeUrl, PREVIEW_KEY } from './_helpers';

/**
 * T-QA-STABILITY-COVERAGE · 错误路径覆盖
 *
 * 验 🅰️ T-FE-STABILITY-ERROR-BOUNDARIES ship 后:每条路径在后端 5xx /
 * timeout / 字段缺失时 都不能白屏 / 不能 throw 出 Next 16 error overlay。
 *
 * 三层防御断言(任一过即认为没白屏):
 *   1. body 有可见文本(reasonable text content count > 0)
 *   2. 没看到 Next 16 "Application error" / "Unhandled Runtime Error" overlay
 *   3. 头部框架(home link / nav / header)还在
 *
 * 看到 PageError(`data-testid="page-error"`)/ ErrorCard
 * (`data-testid="error-card"`)/ "加载失败" 文案是 加分项 · 不强求 ·
 * 因为部分卡片(audit-cards)选择 silent-fallback(setData(null))而不是
 * 显式 ErrorCard 。silent-fallback 也算优雅降级。
 *
 * /history 需要钱包连接才发请求 · 不在本 spec 范围内 ·
 * 钱包态 e2e 走 wallet-history-smoke.spec.ts(qa/e2e-phantom-wallet 那条线)。
 */

const API_PATTERN = '**/ocufi-api*/**';

function withPreview(path: string, key = PREVIEW_KEY) {
  return path.includes('?') ? `${path}&preview=${key}` : `${path}?preview=${key}`;
}

async function stub500(page: Page, body = { ok: false, error: 'simulated upstream 500', trace_id: 'qa-stub' }) {
  await page.route(API_PATTERN, (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function assertNoCrash(page: Page) {
  // 1. body 有内容
  const text = await page.locator('body').innerText().catch(() => '');
  expect(text.length, 'body 几乎没文本 · 疑似白屏').toBeGreaterThan(50);

  // 2. 没 Next 16 error overlay
  const overlay = await page
    .locator('text=/Application error|Unhandled Runtime Error|client-side exception/i')
    .count();
  expect(overlay, '出现 Next 16 error overlay · 错误未被边界拦住').toBe(0);

  // 3. 头部框架还在
  const frameworkVisible = await page
    .locator('a[href="/"], header, nav')
    .first()
    .isVisible()
    .catch(() => false);
  expect(frameworkVisible, '头部框架(home / header / nav)不可见 · 整页挂了').toBe(true);
}

test.describe('error degradation · 后端不可用时不白屏', () => {
  test.setTimeout(60_000);

  test('500 on /admin · 显示 "连接失败" 错误卡', async ({ page }) => {
    await stub500(page);
    await page.goto(`/admin?preview=${PREVIEW_KEY}&key=anything`, {
      waitUntil: 'domcontentloaded',
    });
    // /admin 用 inline 错误卡 · 文案 "连接失败" · 给 fetch 一点时间打出来
    await expect(page.getByText('连接失败')).toBeVisible({ timeout: 15_000 });
    await assertNoCrash(page);
    // 三个数据卡片不应该出现
    await expect(page.locator('[data-testid="admin-fee-revenue-card"]')).toHaveCount(0);
  });

  test('500 on /markets · 不白屏', async ({ page }) => {
    await stub500(page);
    await page.goto(withPreview('/markets'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000); // 等一波 fetch 完
    await assertNoCrash(page);
  });

  test('500 on /trade audit/token endpoints · 整页不挂', async ({ page }) => {
    // 只拦 audit / token 元数据 · 不动 chart / quote · /trade 主体仍 render
    await page.route(API_PATTERN, (route) => {
      const url = route.request().url();
      if (/\/(audit|token\/(audit-card|meta|summary|info)|holders|liquidity)/i.test(url)) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'simulated audit 500' }),
        });
      }
      return route.continue();
    });
    await page.goto(tradeUrl('SOL'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);
    await assertNoCrash(page);
  });

  test('timeout on /markets · 15s ApiError 路径 · 不白屏', async ({ page }) => {
    // 故意永远 hang · ApiClient 15s timeout 触发 后 setError → render 错误态
    await page.route(API_PATTERN, async (route) => {
      // 在 16s 后 abort · 让 ApiClient AbortController 先触发
      setTimeout(() => route.abort('timedout').catch(() => undefined), 16_500);
    });
    await page.goto(withPreview('/markets'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(17_500);
    await assertNoCrash(page);
  });

  test('部分字段缺失 · /admin · 不抛 undefined 异常', async ({ page }) => {
    // /admin/* endpoints 都返成功但 payload 几乎空 · 验前端不解构爆炸
    await page.route(API_PATTERN, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.goto(`/admin?preview=${PREVIEW_KEY}&key=anything`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(4_000);
    await assertNoCrash(page);
  });
});
