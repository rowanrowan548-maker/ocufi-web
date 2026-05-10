'use client';

/**
 * P5-FE-25 · V2 上位 · mobile deeplink modal 全站禁用
 *
 * V1 时代:手机浏览器没 window.phantom 注入 · wallet-adapter 扫不到 · 弹 modal 引导跳 in-app browser
 * V2 时代:用 Phantom Connect OAuth 流程 · 不需要 in-app browser · modal 多余
 *
 * 文件保留(layout 仍引用)· 组件直接 return null · 后续 polish 可删 import
 */
export function MobileDeeplink() {
  return null;
}
