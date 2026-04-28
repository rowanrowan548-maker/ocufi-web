/**
 * Phantom Connect SDK 集成 · 链上侧配置 + 工具(T-PHANTOM-CONNECT-onchain)
 *
 * 背景:Phantom Portal 邮件 Rory 回信(2026-04-29)— V1 公开发布最后阻塞 = 集成
 * Phantom Connect SDK,降低红警 / 让用户走 google/apple/phantom 三轨连接。
 *
 * SDK:`@phantom/react-sdk`(React hook 模式)+ `@phantom/browser-sdk`(类型)
 * 文档:https://docs.phantom.com/sdks/react-sdk
 *
 * 集成模式 · 跟现有 @solana/wallet-adapter 并存:
 *   - 顶层 layout.tsx 在 <SolanaWalletProvider> 外/内 包一层 <PhantomProvider>
 *   - 用户经 Phantom Connect 弹窗(google/apple/phantom)连接 → SDK 暴露 publicKey
 *   - 前端在 ConnectButton 里调 SDK hook,连完后 dispatch 到现有 zustand wallet
 *     store(跟 wallet-adapter 同 store),让 trade/limit form 等不感知数据来源
 *
 * 本 lib 只暴露:
 *   - 配置常量(appId / providers / redirectUrl / appName / appIcon)
 *   - 类型 alias(自定义,不依赖 SDK 包,前端装包后 cast 即可用)
 *   - 工具函数(extractPublicKey / 校验 appId / 构造 config)
 * 不放 React hooks(链上工程师领域 · `src/lib/` 不放 hooks · 前端去用 SDK 自带 hook)
 * 不装 npm 包(留给前端 T-PHANTOM-CONNECT-fe `pnpm add @phantom/react-sdk`)
 */

/**
 * Phantom Portal App ID(env)· 用户已注册:`c732b3d8-0901-...`
 * 必须配,否则 Phantom Connect 弹窗显示"未注册"
 */
export const PHANTOM_APP_ID = process.env.NEXT_PUBLIC_PHANTOM_APP_ID ?? '';

/**
 * OAuth 回调 URL · Phantom Connect 走 google/apple 时需要回跳
 * 默认用站点根 + /auth/phantom-callback,前端可在 layout 路由层补上对应 page
 */
export const PHANTOM_REDIRECT_URL =
  process.env.NEXT_PUBLIC_PHANTOM_REDIRECT_URL ??
  (typeof window !== 'undefined' ? `${window.location.origin}/auth/phantom-callback` : '');

/** 显示在 Phantom Connect 弹窗顶部的 app 名 */
export const PHANTOM_APP_NAME = 'Ocufi · Solana Trading Terminal';

/** 显示在 Phantom Connect 弹窗顶部的 app icon(含 absolute URL) */
export const PHANTOM_APP_ICON =
  process.env.NEXT_PUBLIC_PHANTOM_APP_ICON ?? 'https://www.ocufi.io/apple-touch-icon.png';

/**
 * Phantom Connect 接受的连接方式
 * - google / apple:OAuth 连 phantom embedded wallet(对没装 phantom 的用户)
 * - phantom:phantom extension(等价 wallet-adapter PhantomAdapter)
 * - injected:其他注入式钱包(via Wallet Standard,跟 wallet-adapter 重叠)
 * - deeplink:phantom mobile deeplink
 *
 * V1 暂留全 5 选项 · 让用户挑最顺手的;如果 google/apple 反馈差再调
 */
export type PhantomProviderKind = 'google' | 'apple' | 'phantom' | 'injected' | 'deeplink';
export const PHANTOM_PROVIDERS: PhantomProviderKind[] = [
  'google',
  'apple',
  'phantom',
  'injected',
  'deeplink',
];

/**
 * Phantom Connect Provider 的 config object · 前端直接传给 <PhantomProvider config={}>
 *
 * 类型 loose(unknown)是因为本 lib 不依赖 `@phantom/react-sdk` npm 包(前端装),
 * 前端 import 后 cast 成 SDK 自己的 ProviderConfig type 即可。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PHANTOM_PROVIDER_CONFIG: Record<string, any> = {
  appId: PHANTOM_APP_ID,
  providers: PHANTOM_PROVIDERS,
  // SDK 接受 AddressType.solana enum value;前端装包后可改用 enum,
  // 这里给字符串 'solana' SDK 会按 wallet standard 自动识别
  addressTypes: ['solana'],
  authOptions: {
    redirectUrl: PHANTOM_REDIRECT_URL,
  },
};

/**
 * Phantom Connect SDK 返回的 account 对象的最小描述
 *
 * SDK 实际类型见 `@phantom/browser-sdk` 的 `WalletAddress` interface,
 * 我们这里只 alias 必需字段,前端装包后用 SDK 真类型替代。
 */
export interface PhantomAccount {
  address: string; // base58 publicKey
  addressType?: string; // 'solana' | 'ethereum' | ...
  chainId?: string;
}

/**
 * 从 SDK `useAccounts()` 返回数组提取 Solana publicKey 字符串
 * - null / undefined / 空 → 返回 null
 * - 优先选 addressType === 'solana' 的;否则取第一个
 */
export function extractSolanaPublicKey(
  accounts: PhantomAccount[] | null | undefined
): string | null {
  if (!accounts || accounts.length === 0) return null;
  const solana = accounts.find((a) => a.addressType === 'solana' || a.addressType === undefined);
  return solana?.address ?? accounts[0]?.address ?? null;
}

/** 检查 Phantom Connect 是否可用(env 配置完整)· 前端连接前调一次防裸调 */
export function isPhantomConnectConfigured(): boolean {
  return PHANTOM_APP_ID.length > 0;
}
