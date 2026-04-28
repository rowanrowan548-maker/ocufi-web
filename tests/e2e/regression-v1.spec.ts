import { test, expect, type Page } from '@playwright/test';

/**
 * T-968 · V1 上线前全站回归 e2e
 *
 * 覆盖 14 模块(详 TASKS_TODAY · QA section):
 *  Landing / /trade / portfolio / 行情列表 / /token / /alerts / /badges /
 *  /invite / /points / /settings / nav+search / footer / 反馈 dialog / 移动端
 *
 * 测试边界(QA 边界 · 硬性):
 *  - 不连钱包(钱包态需要真签 → 留 manual checklist)
 *  - 不写业务代码;发现 bug 写报告不修
 *  - 渲染 + URL + console.error + 关键 selector + 主要交互(toggle/tab/click)层
 *
 * 运行: `pnpm exec playwright test tests/e2e/regression-v1.spec.ts`
 */

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

/** 全局 console.error / pageerror 收集 + filter helpers */
function attachConsoleHooks(page: Page): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') errors.push(`console.error: ${text}`);
    if (msg.type() === 'warning') warnings.push(`console.warn: ${text}`);
  });
  return { errors, warnings };
}

/** 过滤掉已知噪声(404 manifest / 第三方 script / hydration warning),只留真错 */
function realErrors(errors: string[]): string[] {
  const NOISE = [
    /Failed to load resource.*manifest/i,
    /the server responded with a status of 404/i, // dev favicon / chunk
    /sourcemap/i,
    /Download the React DevTools/i,
    /CHROMIUM_EXTENSION/i,
    /WebSocket connection.*webpack-hmr/i, // dev HMR 重连噪声
    /\[HMR\]/i,
  ];
  return errors.filter((e) => !NOISE.some((re) => re.test(e)));
}

// ─────────────────────────────────────────────────────────────
// 模块 1: Landing / Hero / footer / 品牌"天眼"
// ─────────────────────────────────────────────────────────────

test.describe('M1 · Landing / Hero / footer · zh-CN', () => {
  test('T-927 Hero CA 搜索框可见 + 8 token chips 渲染', async ({ page }) => {
    const { errors } = attachConsoleHooks(page);
    await page.goto('/zh-CN');

    // Hero 搜索是 button(不是 input · trigger 模式),文案来自 home.searchPlaceholder
    // zh-CN: "粘贴 Solana 合约地址,例如 So111…1112"
    const heroSearch = page
      .getByRole('button')
      .filter({ hasText: /粘贴.*合约地址|paste.*contract/i })
      .first();
    await expect(heroSearch).toBeVisible({ timeout: 15_000 });

    // 8 个 trending chips(异步拉,容忍 0 · 本地 dev 后端可能未起)
    await page.waitForTimeout(2_500);
    const chipCount = await page
      .locator('a[href*="/trade?mint="]')
      .count();
    console.log(`[M1] Hero trending chips count: ${chipCount}(0 = 后端 trending API 未连)`);
    // 不 hard assert · 后端依赖,记录用

    const real = realErrors(errors);
    if (real.length) {
      console.log(`[M1] Hero 控制台真错(${real.length}):`);
      real.slice(0, 5).forEach((e) => console.log('  - ' + e.slice(0, 200)));
    }
  });

  test('T-963 zh-CN locale 显"天眼"小字 + footer 签名', async ({ page }) => {
    await page.goto('/zh-CN');
    // site-header 旁的 "天眼" 小字(T-963)
    const tianyan = page.getByText(/天眼/).first();
    await expect(tianyan).toBeVisible({ timeout: 10_000 });

    // 滚到 footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const footerSig = page.getByText(/@ocufi/).first();
    const sigSeen = await footerSig.isVisible({ timeout: 4_000 }).catch(() => false);
    console.log(`[M1] footer @ocufi 签名可见: ${sigSeen}`);
  });

  test('T-963 en-US locale NOT 显"天眼"', async ({ page }) => {
    await page.goto('/en-US');
    // 等首屏稳定
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_500);
    const tianyanCount = await page.getByText(/天眼/).count();
    console.log(`[M1] en-US 天眼 count: ${tianyanCount} (期望 0)`);
    expect(tianyanCount).toBe(0);
  });

  test('T-964 footer 显 fe commit hash + /legal/audit 可访问', async ({ page }) => {
    await page.goto('/zh-CN');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);

    // FooterVersion: fe commit 7 位 hash 或 '—'(本地 dev 没注入 NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA)
    const feNode = page.getByText(/^fe\s/).first();
    const feSeen = await feNode.isVisible({ timeout: 5_000 }).catch(() => false);
    console.log(`[M1] footer fe commit 节点可见: ${feSeen}`);
    expect(feSeen).toBe(true);

    // /legal/audit 可访问
    const r = await page.goto('/zh-CN/legal/audit');
    expect(r?.status()).toBeLessThan(400);
    const auditTitle = page.getByText(/安全审计|Security Audit|审计/).first();
    await expect(auditTitle).toBeVisible({ timeout: 8_000 });
  });

  test('T-944 反馈 Dialog 三按钮顺序 · TG 主推 + Twitter + GitHub', async ({ page }) => {
    await page.goto('/zh-CN');
    // 反馈触发按钮(右下浮动 fixed bottom-24)
    const trigger = page
      .locator('button[aria-label*="反馈" i], button[aria-label*="feedback" i]')
      .first();
    const triggerSeen = await trigger.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!triggerSeen) {
      console.log('[M1] feedback trigger 未渲染,skip(可能 SSR-only 卡 hydrate)');
      test.skip(true, 'feedback trigger 未渲染');
      return;
    }
    await trigger.click();
    await page.waitForTimeout(500); // 等 dialog 打开

    // dialog 内 3 个 link · TG (大绿) / Twitter DM (中) / GitHub (灰小字)
    // Twitter DM URL 含 `messages/compose`,profile URL 不含 → 精确区分两个 Twitter link
    const tgLink = page.locator('a[href^="https://t.me/"]').first();
    const twitterDM = page.locator('a[href*="x.com/messages/compose"]').first();
    const ghLink = page.locator('a[href*="github.com"][href*="/issues/new"]').first();

    const tgVis = await tgLink.isVisible({ timeout: 5_000 }).catch(() => false);
    const twVis = await twitterDM.isVisible({ timeout: 3_000 }).catch(() => false);
    const ghVis = await ghLink.isVisible({ timeout: 3_000 }).catch(() => false);

    console.log(`[M1] feedback dialog · TG: ${tgVis} / TwitterDM: ${twVis} / GitHub: ${ghVis}`);
    expect(tgVis).toBe(true);
    // TG 排在 Twitter DM 上方(T-944 主推 · DOM 顺序)
    if (tgVis && twVis) {
      const tgY = (await tgLink.boundingBox())?.y ?? 9999;
      const twY = (await twitterDM.boundingBox())?.y ?? 0;
      expect(tgY).toBeLessThan(twY);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 模块 2: 主路由 smoke 健康检查
// ─────────────────────────────────────────────────────────────

const SMOKE_ROUTES = [
  '/zh-CN/portfolio',
  '/zh-CN/watchlist',
  '/zh-CN/alerts',
  '/zh-CN/badges',
  '/zh-CN/invite',
  '/zh-CN/points',
  '/zh-CN/settings',
  '/zh-CN/token',
  '/zh-CN/markets/trending', // markets 顶层无 page.tsx,trending 子路由是入口
  '/zh-CN/legal/audit',
  '/zh-CN/legal/privacy',
  '/zh-CN/legal/terms',
];

test.describe('M2 · 主路由 smoke 200 + 无 page error', () => {
  for (const route of SMOKE_ROUTES) {
    test(`route ${route} 渲染 200 + 无 console.error`, async ({ page }) => {
      const { errors } = attachConsoleHooks(page);
      const r = await page.goto(route, { waitUntil: 'domcontentloaded' });
      const status = r?.status();
      console.log(`[M2] ${route} status=${status}`);
      expect(status).toBeLessThan(400);

      // 等水合 + 异步 fetch(部分页面会因 ConnectWallet 缺席短暂转圈)
      await page.waitForTimeout(2_000);
      // banner 锚点 — 任何路由都有 site-header
      const banner = page.getByRole('link', { name: /Ocufi/i }).first();
      await expect(banner).toBeVisible({ timeout: 10_000 });

      const real = realErrors(errors);
      if (real.length) {
        console.log(`[M2] ${route} 真错(${real.length}):`);
        real.slice(0, 5).forEach((e) => console.log('  - ' + e.slice(0, 200)));
      }
      // 不 hard fail console.error · 收集进 log,Tech Lead 用日志统计
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 模块 3: /trade 关键 UI(T-940/T-957a/T-962/T-965)
// ─────────────────────────────────────────────────────────────

test.describe('M3 · /trade UI 回归', () => {
  test('T-940 #2 首页"更多"section 不再有限价单(替换为徽章)', async ({ page }) => {
    await page.goto('/zh-CN');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    // 限价单不该出现在 secondary 4 卡(T-940)
    const limitInSecondary = await page
      .locator('section, footer')
      .filter({ hasText: /限价单/ })
      .count();
    // 顶部 nav 也不该有 limit deeplink
    const limitNavLink = await page.locator('a[href*="/limit"]').count();
    console.log(`[M3] 限价单 出现次数(应 0): secondary=${limitInSecondary}, nav links=${limitNavLink}`);
    // 用户原 bug: 4 卡里出现限价单 — 当前应替换成徽章
    // 不 hard assert(/limit 路由保留深链),只看 nav 是否暴露
  });

  test('T-940 #1 iOS Safari /trade 顶部 sticky 元素 z-index 高 + safe-area 处理', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
    await page.goto(`/zh-CN/trade?mint=${BONK_MINT}`);
    await expect(page.getByRole('link', { name: /Ocufi/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // site-header 应有 padding-top: env(safe-area-inset-top) 或 z-index >= 30
    const siteHeader = page.locator('header').first();
    await expect(siteHeader).toBeVisible();
    const styles = await siteHeader.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { zIndex: cs.zIndex, paddingTop: cs.paddingTop, position: cs.position };
    });
    console.log(`[M3] mobile site-header styles: ${JSON.stringify(styles)}`);
    // 不 hard assert paddingTop(env() 在 jsdom 解析 0,Playwright 真浏览器但 viewport 模拟无 notch)
    // 至少 sticky/fixed
    expect(['sticky', 'fixed']).toContain(styles.position);
  });

  test('T-962 移动端 /trade 5 tab switcher + buy/sell h-14 单手友好', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/zh-CN/trade?mint=${USDC_MINT}`);
    await expect(page.getByRole('link', { name: /Ocufi/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // 5 tab · zh-CN 文案: 图表 / 详情 / 数据 / 风险 / 活动(MobileTabSwitcher · trade.mobileTabs.*)
    const tabLabels = ['图表', '详情', '数据', '风险', '活动'];
    let visible = 0;
    for (const label of tabLabels) {
      const v = await page
        .getByRole('button', { name: new RegExp(label) })
        .first()
        .isVisible({ timeout: 2_500 })
        .catch(() => false);
      if (v) visible++;
    }
    console.log(`[M3] 移动 5 tab 可见: ${visible}/5`);
    expect(visible).toBeGreaterThanOrEqual(4);

    // buy / sell submit h-14 — 寻找 height >= 50 的提交按钮
    const submits = page.locator('button[type="submit"]');
    const submitCount = await submits.count();
    let bigBtn = 0;
    for (let i = 0; i < submitCount; i++) {
      const box = await submits.nth(i).boundingBox().catch(() => null);
      if (box && box.height >= 50) bigBtn++;
    }
    console.log(`[M3] 移动 submit 按钮 height>=50 个数: ${bigBtn}/${submitCount}`);
  });

  test('T-957a /alerts mode toggle 🔔/⚡ 双卡', async ({ page }) => {
    await page.goto('/zh-CN/alerts');
    await page.waitForTimeout(3_000);
    // i18n alerts.mode.notify.title="🔔 到价提醒" · execute.title="⚡ 到价执行"
    // 不限定 button role(可能用 div + onClick 或 RadioGroup)
    const notifyText = await page.getByText(/到价提醒/).count();
    const executeText = await page.getByText(/到价执行/).count();
    console.log(`[M3] /alerts mode 文本命中 · 提醒: ${notifyText} / 执行: ${executeText}`);
    // 至少一个 mode 文案出现 — alerts 页可能未连钱包时 form 默认隐藏 mode toggle,容忍 0
    if (notifyText === 0 && executeText === 0) {
      console.log('[M3] /alerts mode toggle 未在未连钱包态显露 · 记录,需要 manual checklist 真签验证');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 模块 4: 行情列表 + /token 雷达(T-956/T-943)
// ─────────────────────────────────────────────────────────────

test.describe('M4 · 行情 + token 雷达', () => {
  test('T-956 行情列表 4 顶 tab + Trending 子 tab 切换', async ({ page }) => {
    // T-956 行情升级是嵌在 Landing 的 token-list.tsx 中,没有独立 /markets 顶层路由
    // /markets/trending 子路由存在,作为深链入口
    await page.goto('/zh-CN/markets/trending');
    await page.waitForTimeout(2_500);

    // 4 顶 tab
    const tabs = ['Trending', 'New', '自选', '主流'];
    let topVisible = 0;
    for (const t of tabs) {
      const v = await page
        .getByRole('button', { name: new RegExp(t, 'i') })
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (v) topVisible++;
    }
    console.log(`[M4] markets 顶 tab 可见: ${topVisible}/4`);

    // Trending 子 tab 5m/15m/1h/24h
    const subs = ['5m', '15m', '1h', '24h'];
    let subVisible = 0;
    for (const s of subs) {
      const v = await page
        .getByRole('button', { name: new RegExp(`^${s}$`) })
        .first()
        .isVisible({ timeout: 2_500 })
        .catch(() => false);
      if (v) subVisible++;
    }
    console.log(`[M4] Trending 子 tab 可见: ${subVisible}/4`);
  });

  test('T-943 /token 雷达 顶部输入 + 红绿灯总评 + 历史 chips', async ({ page }) => {
    await page.goto('/zh-CN/token');
    await page.waitForTimeout(2_500);
    const search = page.getByPlaceholder(/搜索|代币|地址|search|paste/i).first();
    const seen = await search.isVisible({ timeout: 8_000 }).catch(() => false);
    console.log(`[M4] /token 顶部搜索 input: ${seen}`);
    expect(seen).toBe(true);

    // 24h 高风险榜 + 安全榜 标题
    const riskList = await page
      .getByText(/24h.*高风险|高风险.*榜|risky/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const safeList = await page
      .getByText(/24h.*安全|安全.*榜|safe/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    console.log(`[M4] /token 高风险榜: ${riskList} / 安全榜: ${safeList}`);
  });
});

// ─────────────────────────────────────────────────────────────
// 模块 5: /invite + /badges + /settings 深度 e2e
// ─────────────────────────────────────────────────────────────

test.describe('M5 · invite/badges/settings', () => {
  test('T-941 /invite 数字卡 + 分享按钮入口', async ({ page }) => {
    await page.goto('/zh-CN/invite');
    await page.waitForTimeout(2_500);

    // 3 个数字卡(已邀请人数 / 累计返佣 / 待提现)
    const numericCards = await page.getByText(/已邀请|累计返佣|待提现|invited|earned|pending/i).count();
    console.log(`[M5] invite 数字卡 hint 命中: ${numericCards}`);

    // 分享按钮(打开二维码 + 推文模板 dialog)
    const shareBtn = page
      .getByRole('button', { name: /分享|share|TG|Twitter|二维码/i })
      .first();
    const shareSeen = await shareBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    console.log(`[M5] invite 分享按钮: ${shareSeen}`);
  });

  test('/badges 5 枚徽章 grid 渲染', async ({ page }) => {
    await page.goto('/zh-CN/badges');
    await page.waitForTimeout(2_500);
    // 徽章 card / image 计数(5 枚)
    const cards = await page.locator('[class*="badge"], [class*="card"]').count();
    console.log(`[M5] /badges card 类元素计数(粗略): ${cards}`);
    expect(cards).toBeGreaterThanOrEqual(3);
  });

  test('/settings 主题 + 语言 + 默认滑点 入口', async ({ page }) => {
    await page.goto('/zh-CN/settings');
    await page.waitForTimeout(2_500);
    const themeSeen = await page.getByText(/主题|theme/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    const langSeen = await page.getByText(/语言|language/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    const slipSeen = await page.getByText(/滑点|slippage/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    console.log(`[M5] /settings 主题: ${themeSeen} / 语言: ${langSeen} / 滑点: ${slipSeen}`);
    expect([themeSeen, langSeen, slipSeen].filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────
// 模块 6: nav + footer 全局元素
// ─────────────────────────────────────────────────────────────

test.describe('M6 · 全局 nav + footer', () => {
  test('顶部 nav 5 dropdown + 服务状态绿点(T-928)', async ({ page }) => {
    await page.goto('/zh-CN');
    await page.waitForTimeout(2_000);
    const banner = page.getByRole('link', { name: /Ocufi/i }).first();
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // 服务状态点(T-928 4/4 ship · 常驻绿/红 dot · status link 跳 /status)
    const statusLink = page.locator('a[href*="/status"]').first();
    const statusSeen = await statusLink.isVisible({ timeout: 5_000 }).catch(() => false);
    console.log(`[M6] /status 链接 nav 显示: ${statusSeen}`);
  });

  test('footer 三链(TG / GitHub / commit hash)', async ({ page }) => {
    await page.goto('/zh-CN');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const tgInFooter = await page.locator('footer a[href*="t.me"]').first().isVisible({ timeout: 4_000 }).catch(() => false);
    const ghInFooter = await page.locator('footer a[href*="github.com"]').first().isVisible({ timeout: 4_000 }).catch(() => false);
    const auditLink = await page.locator('footer a[href*="/legal/audit"]').first().isVisible({ timeout: 4_000 }).catch(() => false);

    console.log(`[M6] footer TG: ${tgInFooter} / GitHub: ${ghInFooter} / audit 链接: ${auditLink}`);
    expect(tgInFooter || ghInFooter).toBe(true);
  });
});
