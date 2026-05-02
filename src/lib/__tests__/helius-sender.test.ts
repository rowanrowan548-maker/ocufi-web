// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  HELIUS_SENDER_TIP_ACCOUNTS,
  HELIUS_SENDER_DEFAULT_TIP_LAMPORTS,
  getSenderRoute,
  getSenderTipLamports,
  getSenderRpcUrl,
  getSenderConnection,
  isSenderEnabled,
  pickTipAccount,
  shouldUseSender,
} from '@/lib/helius-sender';

/**
 * T-CHAIN-MEV-PROTECTION Phase B · helius-sender.ts 单测
 *
 * 覆盖:
 *   - 10 tip account 常量 + 类型 + 都是合法 base58 PublicKey
 *   - 默认值 100_000 lamports / 'fast' 路由
 *   - getSenderRpcUrl env 拼接(enabled / disabled / route / api-key 4 个维度)
 *   - getSenderConnection / isSenderEnabled fallback
 *   - pickTipAccount 随机轮询 + seed 固定
 *   - shouldUseSender 总开关边界
 */

const ENV_KEYS = [
  'NEXT_PUBLIC_HELIUS_SENDER_ENABLED',
  'NEXT_PUBLIC_HELIUS_SENDER_API_KEY',
  'NEXT_PUBLIC_HELIUS_SENDER_ROUTE',
  'NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS',
] as const;

const ORIGINAL: Record<string, string | undefined> = {};

beforeEach(() => {
  // 备份 + 清 env · 单测之间隔离
  for (const k of ENV_KEYS) {
    ORIGINAL[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (ORIGINAL[k] !== undefined) process.env[k] = ORIGINAL[k];
    else delete process.env[k];
  }
});

describe('TIP_ACCOUNTS 常量', () => {
  it('恰好 10 个 tip account(Helius 文档实证 2026-05-02)', () => {
    expect(HELIUS_SENDER_TIP_ACCOUNTS).toHaveLength(10);
  });

  it('全部 base58 合法 · 可构造 PublicKey 不抛', () => {
    for (const addr of HELIUS_SENDER_TIP_ACCOUNTS) {
      expect(() => new PublicKey(addr)).not.toThrow();
    }
  });

  it('全部 unique · 无重复地址', () => {
    const set = new Set(HELIUS_SENDER_TIP_ACCOUNTS);
    expect(set.size).toBe(HELIUS_SENDER_TIP_ACCOUNTS.length);
  });

  it('包含文档第一个 tip account 4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE', () => {
    expect(HELIUS_SENDER_TIP_ACCOUNTS).toContain(
      '4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE'
    );
  });
});

describe('默认常量(决策 1+2 · TL 拍)', () => {
  it('默认 tip lamports = 100_000(决策 2)', () => {
    expect(HELIUS_SENDER_DEFAULT_TIP_LAMPORTS).toBe(100_000);
    expect(getSenderTipLamports()).toBe(100_000);
  });

  it('默认路由 = fast(决策 1)', () => {
    expect(getSenderRoute()).toBe('fast');
  });
});

describe('getSenderTipLamports · env 边界', () => {
  it('env 整数 → 接受', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS = '50000';
    expect(getSenderTipLamports()).toBe(50000);
  });

  it('env 非数字 → 兜底默认 100_000', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS = 'abc';
    expect(getSenderTipLamports()).toBe(100_000);
  });

  it('env 负数 → 兜底默认 100_000', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS = '-100';
    expect(getSenderTipLamports()).toBe(100_000);
  });

  it('env 0 → 兜底默认 100_000(0 是误配 · 安全起见拒绝)', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS = '0';
    expect(getSenderTipLamports()).toBe(100_000);
  });
});

describe('getSenderRoute · env 边界', () => {
  it('显式 fast → fast', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE = 'fast';
    expect(getSenderRoute()).toBe('fast');
  });

  it('显式 swqos_only → swqos_only', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE = 'swqos_only';
    expect(getSenderRoute()).toBe('swqos_only');
  });

  it('SwQoS_OnLy 大小写混 → swqos_only(lowercase 兼容)', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE = 'SwQoS_OnLy';
    expect(getSenderRoute()).toBe('swqos_only');
  });

  it('未知值 → 兜底 fast(默认值 · 决策 1)', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE = 'turbo';
    expect(getSenderRoute()).toBe('fast');
  });
});

describe('getSenderRpcUrl · 4 个维度', () => {
  it('enabled 未配 → null(默认关 · 灰度)', () => {
    expect(getSenderRpcUrl()).toBeNull();
    expect(isSenderEnabled()).toBe(false);
    expect(getSenderConnection()).toBeNull();
  });

  it('enabled=0 → null', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '0';
    expect(getSenderRpcUrl()).toBeNull();
  });

  it('enabled=1 + 默认 fast + 无 api-key → https://sender.helius-rpc.com/fast', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    expect(getSenderRpcUrl()).toBe('https://sender.helius-rpc.com/fast');
  });

  it('enabled=1 + swqos_only + 无 api-key → ?swqos_only=true', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE = 'swqos_only';
    expect(getSenderRpcUrl()).toBe('https://sender.helius-rpc.com/fast?swqos_only=true');
  });

  it('enabled=1 + fast + api-key → ?api-key=encoded', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_API_KEY = 'abc xyz';
    // encodeURIComponent 把空格 → %20
    expect(getSenderRpcUrl()).toBe(
      'https://sender.helius-rpc.com/fast?api-key=abc%20xyz'
    );
  });

  it('enabled=1 + swqos_only + api-key → 两个 query 都有', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE = 'swqos_only';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_API_KEY = 'k1';
    expect(getSenderRpcUrl()).toBe(
      'https://sender.helius-rpc.com/fast?swqos_only=true&api-key=k1'
    );
  });
});

describe('pickTipAccount', () => {
  it('返 PublicKey · 在 10 个 tip 列表里', () => {
    const pk = pickTipAccount();
    expect(pk).toBeInstanceOf(PublicKey);
    expect(HELIUS_SENDER_TIP_ACCOUNTS).toContain(pk.toBase58());
  });

  it('seed=0 → 第 0 个 tip account(确定性)', () => {
    const pk = pickTipAccount(0);
    expect(pk.toBase58()).toBe(HELIUS_SENDER_TIP_ACCOUNTS[0]);
  });

  it('seed=12345 → idx = 12345 % 10 = 5', () => {
    const pk = pickTipAccount(12345);
    expect(pk.toBase58()).toBe(HELIUS_SENDER_TIP_ACCOUNTS[5]);
  });

  it('seed=-3 → 用 abs · idx = 3 % 10 = 3', () => {
    const pk = pickTipAccount(-3);
    expect(pk.toBase58()).toBe(HELIUS_SENDER_TIP_ACCOUNTS[3]);
  });
});

describe('shouldUseSender · 总开关边界', () => {
  it('enabled 未配 → false', () => {
    expect(shouldUseSender()).toBe(false);
  });

  it('enabled=1 + 默认 → true(决策 1+2 默认值满足要求)', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    expect(shouldUseSender()).toBe(true);
  });

  it('enabled=1 + fast + tip < 5_000 → false(防误配 · 文档 fast 要求 ≥ 0.0002 SOL)', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS = '4000';
    expect(shouldUseSender()).toBe(false);
  });

  it('enabled=1 + swqos_only + tip < 1_000 → false', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE = 'swqos_only';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS = '500';
    expect(shouldUseSender()).toBe(false);
  });

  it('enabled=1 + swqos_only + tip 5_000 → true(swqos_only 下限是 1_000)', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ROUTE = 'swqos_only';
    process.env.NEXT_PUBLIC_HELIUS_SENDER_TIP_LAMPORTS = '5000';
    expect(shouldUseSender()).toBe(true);
  });
});

describe('getSenderConnection', () => {
  it('enabled=1 → 返 Connection(rpcEndpoint 含 sender.helius-rpc.com)', () => {
    process.env.NEXT_PUBLIC_HELIUS_SENDER_ENABLED = '1';
    const conn = getSenderConnection();
    expect(conn).not.toBeNull();
    expect(conn?.rpcEndpoint).toContain('sender.helius-rpc.com');
  });

  it('enabled 未配 → null', () => {
    expect(getSenderConnection()).toBeNull();
  });
});
