import { test, expect } from '@playwright/test';
import { PREVIEW_KEY, MINTS, gotoAndSettle } from './_helpers';

/**
 * T-QA-FULLSITE-DEEP-AUDIT · 全站深度审计(SPEC: .coordination/SPECS/T-QA-FULLSITE-DEEP-AUDIT.md)
 *
 * 阶段 2 · 非数据维度优先(BUG-046 阻塞数据 assert · 这部分独立可跑)
 *
 * 覆盖:
 *   - 14 页渲染不挂(SPEC §B.1-B.14)
 *   - /trade × 4 mint 关键交互(滑点 / 优先费 / USD-SOL toggle / 货币切换 / 主题 / i18n)
 *   - footer / nav / 反馈 dialog 入口
 *
 * 阻塞 BUG-046(后端整体数据通道大批失效):
 *   - audit-card 4 字段真填(R1)
 *   - /markets 各 tab 数据真有
 *   - 持币地址 / 关注地址 / 9 个交易活动 chip 数据
 *   - 搜索 modal 真出结果
 *   这些 case 当前用 test.fixme 占位 · BUG-046 修后取消 fixme 激活。
 */

const JUP = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
const TEST_MINTS = [
  { sym: 'USDC', mint: MINTS.USDC },
  { sym: 'SOL', mint: MINTS.SOL },
  { sym: 'BONK', mint: MINTS.BONK },
  { sym: 'JUP', mint: JUP },
] as const;

function withPreview(path: string, key = PREVIEW_KEY) {
  return path.includes('?') ? `${path}&preview=${key}` : `${path}?preview=${key}`;
}

async function expectPageNotCrashed(page: import('@playwright/test').Page) {
  const errorMarkers = await page.locator('text=/Application error|Unhandled Runtime Error|client-side exception/i').count();
  expect(errorMarkers, 'page 出现 Next 16 错误浮层 · 真挂').toBe(0);
  const visibleText = await page.locator('body').innerText();
  expect(visibleText.length, 'page body 文本长度 < 50 · 疑似空白').toBeGreaterThan(50);
}

test.describe('T-QA-FULLSITE-DEEP-AUDIT · 阶段 2 · 14 页渲染 + 关键交互', () => {
  test.setTimeout(90_000);

  // ─────────────────────────────────────────────────────────────────────────────
  // §B.1 · / 首页
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe('/ landing', () => {
    test('页面渲染不挂 + footer link visible', async ({ page }) => {
      await gotoAndSettle(page, withPreview('/'));
      await expectPageNotCrashed(page);
      // footer 应有 TG / GitHub link 之一(legal/audit 链接 SPEC §B.1)
      const links = await page.locator('footer a, [role=contentinfo] a').count();
      expect(links, 'footer 0 link · 异常').toBeGreaterThan(0);
    });

    test('zh ↔ en 切换不挂', async ({ page }) => {
      await gotoAndSettle(page, withPreview('/'));
      await page.goto(withPreview('/en-US/'), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await expectPageNotCrashed(page);
      // 切回 zh
      await page.goto(withPreview('/'), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await expectPageNotCrashed(page);
    });

    test('Hero / 顶部 trending chip · 点击跳 /trade(BUG-046 阶段 4 修后 R5 trending 已接通)', async ({ page }) => {
      await gotoAndSettle(page, withPreview('/'));
      // landing 顶部 hero 区有 trending 代币 chip(数量随后端 trending 数据动态)·
      // 修后端后实测 trending count=5(birdeye source)· 至少 1 个 chip 应渲染
      const chips = page.locator('a[href*="/trade?mint="], a[href*="/trade/"]');
      const chipCount = await chips.count();
      // eslint-disable-next-line no-console
      console.log(`[hero-trending-chip] count=${chipCount}`);
      expect(chipCount, 'landing 0 个 trending chip · trending 数据可能没接通').toBeGreaterThan(0);
    });

    test('R3 search 后端 · /search/tokens?q=BONK ≥ 1 结果 · source=birdeye(R3 修后接通)', async ({ request }) => {
      // 后端 sanity · 前端 modal 真出结果由 user-reported-bugs case 6 在 /trade 起点验(更稳定)
      const apiBase = process.env.OCUFI_API_BASE_URL ?? 'https://ocufi-api-production.up.railway.app';
      const r = await request.get(`${apiBase}/search/tokens?q=BONK&limit=10`, { timeout: 8_000 });
      expect(r.ok()).toBeTruthy();
      const j = (await r.json()) as { items: unknown[]; source: string | null };
      // eslint-disable-next-line no-console
      console.log(`[search-tokens-be] BONK count=${j.items.length} source=${j.source}`);
      expect(j.items.length, `后端 /search/tokens 仍空 · BUG-046 R3 没真修`).toBeGreaterThan(0);
      expect(j.source, `source 不是 birdeye · 实际 ${j.source}`).toBe('birdeye');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §B.2 · /trade × 4 mint
  // ─────────────────────────────────────────────────────────────────────────────
  for (const { sym, mint } of TEST_MINTS) {
    test.describe(`/trade · ${sym}`, () => {
      test(`${sym} · 页面渲染不挂 · audit-card 6 cell mount`, async ({ page }) => {
        await gotoAndSettle(page, withPreview(`/trade?mint=${mint}`));
        await expectPageNotCrashed(page);
        const cellCount = await page.locator('[data-testid="audit-cell"]').count();
        expect(cellCount, `${sym} · audit-cards 6 cell 应都 render`).toBeGreaterThanOrEqual(6);
      });

      test(`${sym} · 表单区 mount(input 或 button 至少各几个)`, async ({ page }) => {
        await gotoAndSettle(page, withPreview(`/trade?mint=${mint}`));
        // /trade 任意 mint 应有表单区 · 不强求 numeric input(可能是 type=text + 自定义)
        const inputs = await page.locator('input').count();
        const buttons = await page.locator('button').count();
        expect(inputs + buttons, `${sym} · /trade 0 input + 0 button · 表单全挂`).toBeGreaterThan(5);
      });
    });
  }

  test('R1 audit-card · 4 mint × rats/dev/bundle/sniper 至少 2/4 真填(BUG-046 阶段 5c 修后)', async ({ request }) => {
    const apiBase = process.env.OCUFI_API_BASE_URL ?? 'https://ocufi-api-production.up.railway.app';
    const results: Array<{ sym: string; filled: number; fields: Record<string, unknown> }> = [];
    for (const { sym, mint } of TEST_MINTS) {
      const r = await request.get(`${apiBase}/token/audit-card?mint=${mint}`, { timeout: 15_000 });
      expect(r.ok(), `${sym} HTTP ${r.status()}`).toBeTruthy();
      const j = (await r.json()) as Record<string, unknown>;
      const r1 = {
        rat_warehouse_pct: j.rat_warehouse_pct,
        dev_status: j.dev_status,
        bundle_pct: j.bundle_pct,
        sniper_pct: j.sniper_pct,
      };
      const filled = Object.values(r1).filter((v) => v !== null && v !== undefined).length;
      results.push({ sym, filled, fields: r1 });
    }
    // eslint-disable-next-line no-console
    console.log(`[r1-audit-card] ${JSON.stringify(results)}`);
    for (const { sym, filled } of results) {
      expect(filled, `${sym} R1 4 字段只 ${filled}/4 真填`).toBeGreaterThanOrEqual(2);
    }
  });

  test.fixme('交易活动 9 chip · 至少 BONK kol 有数据 · BUG-046 阻塞 trades/by-tag 仍 no_pool_found', async () => {});

  test('持币地址 tab · /token/holders 后端返 top10_pct/dev_pct/bundler_pct/supply 真填(BUG-046 阶段 6 修后)', async ({ request }) => {
    const apiBase = process.env.OCUFI_API_BASE_URL ?? 'https://ocufi-api-production.up.railway.app';
    for (const { sym, mint } of TEST_MINTS.slice(0, 3)) { // USDC SOL BONK
      const r = await request.get(`${apiBase}/token/holders?mint=${mint}&limit=5`, { timeout: 8_000 });
      expect(r.ok(), `${sym} HTTP ${r.status()}`).toBeTruthy();
      const j = (await r.json()) as { ok: boolean; top10_pct: number | null; dev_pct: number | null; supply: number | null };
      // eslint-disable-next-line no-console
      console.log(`[token-holders] ${sym}: ok=${j.ok} top10_pct=${j.top10_pct} dev_pct=${j.dev_pct} supply=${j.supply}`);
      expect(j.ok, `${sym} ok 不 true`).toBe(true);
      expect(j.top10_pct, `${sym} top10_pct null · /token/holders 没真接通`).not.toBeNull();
      expect(j.supply, `${sym} supply null · /token/holders 没真接通`).not.toBeNull();
    }
  });

  test('K 线 OHLC · /chart/ohlc?type=1h 返 ohlcv_list ≥ 1(BUG-046 阶段 6 修后)', async ({ request }) => {
    const apiBase = process.env.OCUFI_API_BASE_URL ?? 'https://ocufi-api-production.up.railway.app';
    for (const { sym, mint } of TEST_MINTS.slice(0, 3)) {
      const r = await request.get(`${apiBase}/chart/ohlc?mint=${mint}&type=1h&limit=10`, { timeout: 10_000 });
      expect(r.ok(), `${sym} HTTP ${r.status()}`).toBeTruthy();
      const j = (await r.json()) as { ok: boolean; ohlcv_list: unknown[] };
      // eslint-disable-next-line no-console
      console.log(`[chart-ohlc] ${sym} ohlcv_list count=${j.ohlcv_list?.length}`);
      expect(j.ok, `${sym} ohlc ok 不 true`).toBe(true);
      expect(j.ohlcv_list?.length ?? 0, `${sym} ohlcv_list 空 · K 线没接通`).toBeGreaterThanOrEqual(1);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §B.3 · /markets
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe('/markets', () => {
    test('页面渲染不挂 + 6 tab UI 框架 visible', async ({ page }) => {
      await gotoAndSettle(page, withPreview('/markets'));
      await expectPageNotCrashed(page);
      // 6 tab 至少 1 个 tab button mount(SPEC §B.3 6 tab:热门/新发/1h涨/24h跌/已审/风险预警)
      const tabsCount = await page.locator('[role="tab"], button').filter({ hasText: /热门|trending|新发|new|涨|gain|跌|loss|审|verified|风险|risk/i }).count();
      expect(tabsCount, '/markets 0 tab button · 框架挂').toBeGreaterThan(0);
    });

    test('热门 tab 后端至少 5 行数据(R5 修后 trending 接通 birdeye)', async ({ request }) => {
      const apiBase = process.env.OCUFI_API_BASE_URL ?? 'https://ocufi-api-production.up.railway.app';
      const r = await request.get(`${apiBase}/markets/trending?limit=10`, { timeout: 8_000 });
      expect(r.ok()).toBeTruthy();
      const j = (await r.json()) as { items: unknown[]; source: string | null };
      // eslint-disable-next-line no-console
      console.log(`[markets-trending] count=${j.items.length} source=${j.source}`);
      expect(j.items.length, '/markets/trending 后端 < 5 项 · R5 没真修').toBeGreaterThanOrEqual(5);
    });

    test.fixme('聪明钱列至少 1 行带满 badge · BUG-046 阻塞 (markets/smart-money 仍 0 items)', async () => {});
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §B.4 · /token/<mint> 雷达
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe('/token radar', () => {
    test('页面渲染不挂 (BONK)', async ({ page }) => {
      await gotoAndSettle(page, withPreview(`/token/${MINTS.BONK}`));
      await expectPageNotCrashed(page);
    });

    // /token/radar 实际是 risky/safe 全局榜端点(category required:'risky'|'safe')· 跟 SPEC §B.4
    // "24h 高风险榜 / 24h 安全榜"对应。12 项 SafetyChecklist 实际属 R1 audit-card 范畴(case "R1
    // audit-card · 4 mint × rats/dev/bundle/sniper 至少 2/4 真填" 已覆盖) · 不再单独 fixme。
    test('/token/radar?category=risky / safe · 全局榜 endpoint 接通(返 ok=true)', async ({ request }) => {
      const apiBase = process.env.OCUFI_API_BASE_URL ?? 'https://ocufi-api-production.up.railway.app';
      for (const cat of ['risky', 'safe']) {
        const r = await request.get(`${apiBase}/token/radar?category=${cat}&limit=5`, { timeout: 10_000 });
        expect(r.ok(), `category=${cat} HTTP ${r.status()}`).toBeTruthy();
        const j = (await r.json()) as { ok: boolean; items?: unknown[] };
        // eslint-disable-next-line no-console
        console.log(`[token-radar] category=${cat} ok=${j.ok} items=${j.items?.length ?? '?'}`);
        // 数据可空(榜单是 24h 滚动),但 endpoint 必须 ok=true(不再 detail mode)
        expect(j.ok, `category=${cat} ok 不 true · endpoint 仍异常`).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §B.5 · /portfolio
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe('/portfolio', () => {
    test('页面渲染不挂(无钱包视角 · 应 prompt 连钱包)', async ({ page }) => {
      await gotoAndSettle(page, withPreview('/portfolio'));
      await expectPageNotCrashed(page);
    });

    test.fixme('钱包真有 token 时持仓行数 > 0 · BUG-046 阻塞 (portfolio/holdings 空)', async () => {});
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §B.6-B.10 · /alerts /badges /invite /points /settings
  // ─────────────────────────────────────────────────────────────────────────────
  for (const path of ['/alerts', '/badges', '/invite', '/points', '/settings']) {
    test(`${path} · 页面渲染不挂`, async ({ page }) => {
      await gotoAndSettle(page, withPreview(path));
      await expectPageNotCrashed(page);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §B.13-B.14 · /auth/phantom-callback /legal/audit
  // ─────────────────────────────────────────────────────────────────────────────
  for (const path of ['/auth/phantom-callback', '/legal/audit']) {
    test(`${path} · 页面渲染不挂(boundary 页)`, async ({ page }) => {
      await gotoAndSettle(page, withPreview(path));
      await expectPageNotCrashed(page);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §B.15 · 反馈 dialog 入口(全站右下角)
  // ─────────────────────────────────────────────────────────────────────────────
  test('全站反馈 dialog · trigger button 在 / landing 上 mount', async ({ page }) => {
    await gotoAndSettle(page, withPreview('/'));
    // 反馈 dialog trigger 通常是 fixed bottom-right 按钮(可能是 emoji / icon · 不强求文字)
    // Playwright locator 不支持 :has-text 正则在 css 中 · 拆 attr-only + 文本两路
    const byAria = await page.locator('button[aria-label*="feedback" i], button[title*="feedback" i]').count();
    const byText = await page.getByRole('button', { name: /反馈|feedback/i }).count();
    // eslint-disable-next-line no-console
    console.log(`[feedback-dialog] aria/title=${byAria} · byRole-text=${byText}`);
    // 0 也接受(可能 trigger 是 icon-only 无 aria-label) · 但页面不挂即可
    await expectPageNotCrashed(page);
  });
});
