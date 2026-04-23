import { defineRouting } from 'next-intl/routing';

/**
 * i18n 路由配置
 * V1 只启用 zh-CN;V2 扩展 en-US(架构已预留)
 */
export const routing = defineRouting({
  locales: ['zh-CN', 'en-US'],
  defaultLocale: 'zh-CN',
  // as-needed: 默认语言不加前缀(/about),其他语言 /en-US/about
  // V1 只有 zh-CN 实装,as-needed 表现为所有路径无前缀
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
