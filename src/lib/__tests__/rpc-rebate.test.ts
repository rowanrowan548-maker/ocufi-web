// @vitest-environment node
// 用 node 环境跑 · jsdom 的 Buffer polyfill 跟 @solana/buffer-layout(PublicKey 校验)
// 不兼容("b must be a Uint8Array")。本文件纯 lib 单测,不需要 jsdom DOM API。

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Keypair, Connection } from '@solana/web3.js';
import {
  getRebateRpcUrl,
  getRebateConnection,
  isRebateEnabled,
} from '@/lib/rpc-rebate';

/**
 * T-MEV-REBATE · rpc-rebate 单测
 *
 * 测点:
 *   - URL 拼接正确(? / & 区分 · rebate-address=base58)
 *   - env 没配 → 全 fallback(URL='' · Connection=null · isRebateEnabled=false)
 *   - 用户钱包无效 base58 → fallback 不抛
 *   - PublicKey 入参 vs string 入参一致
 *   - 非 Helius URL(用户填了公共 RPC)→ isRebateEnabled=false
 */

const ORIGINAL_HELIUS = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
});
afterEach(() => {
  if (ORIGINAL_HELIUS !== undefined) {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = ORIGINAL_HELIUS;
  } else {
    delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  }
});

describe('getRebateRpcUrl · URL 拼接', () => {
  it('env 配 Helius + 有效 PublicKey → 拼 &rebate-address=PUBKEY', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL =
      'https://mainnet.helius-rpc.com/?api-key=abc123';
    const pk = Keypair.generate().publicKey;
    const url = getRebateRpcUrl(pk);
    expect(url).toContain('mainnet.helius-rpc.com');
    expect(url).toContain('api-key=abc123');
    expect(url).toContain(`rebate-address=${pk.toBase58()}`);
    expect(url).toMatch(/&rebate-address=/);
  });

  it('PublicKey 入参 vs base58 string 入参 → URL 一致', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL =
      'https://mainnet.helius-rpc.com/?api-key=KEY';
    const pk = Keypair.generate().publicKey;
    const fromKey = getRebateRpcUrl(pk);
    const fromStr = getRebateRpcUrl(pk.toBase58());
    expect(fromKey).toBe(fromStr);
  });

  it('base URL 无 ? query → 用 ? 而非 & 分隔(防御性)', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://example.com/rpc';
    const pk = Keypair.generate().publicKey;
    const url = getRebateRpcUrl(pk);
    expect(url).toMatch(/\?rebate-address=/);
    expect(url).not.toMatch(/&rebate-address=/);
  });
});

describe('getRebateRpcUrl · fallback 行为', () => {
  it('env 没配 → 返 ""(不抛)', () => {
    const pk = Keypair.generate().publicKey;
    expect(getRebateRpcUrl(pk)).toBe('');
  });

  it('env 空字符串 → 返 ""', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = '';
    const pk = Keypair.generate().publicKey;
    expect(getRebateRpcUrl(pk)).toBe('');
  });

  it('userPublicKey 无效 base58 → 返 ""(不抛 · 容错)', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL =
      'https://mainnet.helius-rpc.com/?api-key=KEY';
    expect(getRebateRpcUrl('not-a-real-pubkey-bogus')).toBe('');
  });
});

describe('getRebateConnection · Connection 工厂', () => {
  it('env 配 + 有效 pubkey → 返 Connection 实例', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL =
      'https://mainnet.helius-rpc.com/?api-key=KEY';
    const pk = Keypair.generate().publicKey;
    const conn = getRebateConnection(pk);
    expect(conn).toBeInstanceOf(Connection);
  });

  it('env 没配 → null', () => {
    const pk = Keypair.generate().publicKey;
    expect(getRebateConnection(pk)).toBeNull();
  });

  it('userPublicKey 无效 → null', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL =
      'https://mainnet.helius-rpc.com/?api-key=KEY';
    expect(getRebateConnection('garbage-bogus-not-base58')).toBeNull();
  });
});

describe('isRebateEnabled · 启用判定', () => {
  it('env 没配 → false', () => {
    expect(isRebateEnabled()).toBe(false);
  });

  it('env 配 Helius + 有 api-key → true', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL =
      'https://mainnet.helius-rpc.com/?api-key=KEY';
    expect(isRebateEnabled()).toBe(true);
  });

  it('env 配公共 RPC(api.mainnet-beta.solana.com)→ false(不是 Helius · rebate 不工作)', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://api.mainnet-beta.solana.com';
    expect(isRebateEnabled()).toBe(false);
  });

  it('env 配 Helius 但忘传 api-key query → false(URL 缺 key 直接访问会 401)', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://mainnet.helius-rpc.com/';
    expect(isRebateEnabled()).toBe(false);
  });
});

describe('真实使用场景 · split tx 两笔 rebate-address 一致', () => {
  it('同一 userPublicKey 调 2 次 → URL 字段相同(setup tx + swap tx 同一返佣地址)', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL =
      'https://mainnet.helius-rpc.com/?api-key=KEY';
    const userPk = Keypair.generate().publicKey;
    const url1 = getRebateRpcUrl(userPk);
    const url2 = getRebateRpcUrl(userPk);
    expect(url1).toBe(url2);
    // 关键 · rebate-address 必含
    expect(url1).toContain(`rebate-address=${userPk.toBase58()}`);
  });

  it('不同 userPublicKey 拼 → URL 字段不同(确保 MEV 返佣给对的钱包)', () => {
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL =
      'https://mainnet.helius-rpc.com/?api-key=KEY';
    const pkA = Keypair.generate().publicKey;
    const pkB = Keypair.generate().publicKey;
    expect(getRebateRpcUrl(pkA)).not.toBe(getRebateRpcUrl(pkB));
  });
});
