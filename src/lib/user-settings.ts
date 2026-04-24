/**
 * 用户本地设置
 *
 * 字段尽量保守,不滥用 localStorage:
 *  - customSlippageBps:覆盖稳定币/蓝筹/meme 的默认滑点
 */

const KEY = 'ocufi.settings.v1';

export interface SlippageProfile {
  stable: number;    // bps,默认 50 (0.5%)
  verified: number;  // 默认 100 (1%)
  meme: number;      // 默认 500 (5%)
}

export const DEFAULT_SLIPPAGE: SlippageProfile = {
  stable: 50,
  verified: 100,
  meme: 500,
};

export interface UserSettings {
  customSlippage?: SlippageProfile;
}

export function loadSettings(): UserSettings {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSettings(s: UserSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

export function resetSettings(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}

export function getSlippageProfile(): SlippageProfile {
  const custom = loadSettings().customSlippage;
  return {
    stable: custom?.stable ?? DEFAULT_SLIPPAGE.stable,
    verified: custom?.verified ?? DEFAULT_SLIPPAGE.verified,
    meme: custom?.meme ?? DEFAULT_SLIPPAGE.meme,
  };
}
