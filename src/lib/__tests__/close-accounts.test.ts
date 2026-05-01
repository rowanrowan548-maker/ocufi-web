// @vitest-environment node
// 跑 node · 避 jsdom Buffer polyfill 跟 @solana/buffer-layout 冲突("b must be a Uint8Array")

import { describe, it, expect } from 'vitest';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import {
  createCloseAccountIx,
  buildBatchCloseAccountTxs,
  type CloseTarget,
} from '@/lib/close-accounts';
import {
  PHANTOM_SAFE_SIZE_LIMIT,
} from '@/lib/swap-with-fee';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@/lib/portfolio';

/**
 * T-REWARDS-CLOSE-ACCOUNT-TX · close-accounts 单测
 *
 * 测点(SPEC 要求 5 case):
 *   1. 空 targets → []
 *   2. 1 个 ATA → 1 笔 tx
 *   3. 24 个 ATA → 1 笔(SPEC 期望 24-30 装得下)
 *   4. 30 个 ATA → ≤ 2 笔(临界值)
 *   5. 100 个 ATA → ≥ 3 笔(自动拆)
 *
 * 加 createCloseAccountIx 字段校验 · 跟 Token-2022 兼容验证
 */

const FAKE_BLOCKHASH = '11111111111111111111111111111111';

function gen(n: number): CloseTarget[] {
  const out: CloseTarget[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ ata: Keypair.generate().publicKey });
  }
  return out;
}

describe('createCloseAccountIx · 字段格式', () => {
  it('classic SPL Token · 默认 programId · 3 keys + data=[9]', () => {
    const ata = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const ix = createCloseAccountIx(ata, owner);

    expect(ix.programId.toBase58()).toBe(TOKEN_PROGRAM_ID.toBase58());
    expect(ix.keys).toHaveLength(3);
    // account to close · writable · 非 signer
    expect(ix.keys[0].pubkey.toBase58()).toBe(ata.toBase58());
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[0].isSigner).toBe(false);
    // destination · writable · 非 signer · 押金返还到 owner
    expect(ix.keys[1].pubkey.toBase58()).toBe(owner.toBase58());
    expect(ix.keys[1].isWritable).toBe(true);
    expect(ix.keys[1].isSigner).toBe(false);
    // owner authority · signer · 非 writable
    expect(ix.keys[2].pubkey.toBase58()).toBe(owner.toBase58());
    expect(ix.keys[2].isSigner).toBe(true);
    expect(ix.keys[2].isWritable).toBe(false);
    // data: [9] · CloseAccount discriminator
    expect(ix.data.length).toBe(1);
    expect(ix.data[0]).toBe(9);
  });

  it('Token-2022 programId · ix.programId 跟着切', () => {
    const ata = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const ix = createCloseAccountIx(ata, owner, TOKEN_2022_PROGRAM_ID);
    expect(ix.programId.toBase58()).toBe(TOKEN_2022_PROGRAM_ID.toBase58());
    // data 同 classic(SPL Token discriminator 跟 Token-2022 兼容)
    expect(ix.data[0]).toBe(9);
  });

  it('押金返还固定到 owner · 不能定向其他地址(防 phishing)', () => {
    const ata = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const ix = createCloseAccountIx(ata, owner);
    // destination(keys[1])必为 owner · API 不暴露 destination 参数
    expect(ix.keys[1].pubkey.toBase58()).toBe(owner.toBase58());
  });
});

describe('buildBatchCloseAccountTxs · 拆笔策略(SPEC 5 case)', () => {
  const owner = Keypair.generate().publicKey;

  it('case 1 · 空 targets → 返 []', () => {
    expect(buildBatchCloseAccountTxs([], owner, FAKE_BLOCKHASH)).toEqual([]);
  });

  it('case 2 · 1 个 ATA → 1 笔 tx · size 远小于 1150', () => {
    const txs = buildBatchCloseAccountTxs(gen(1), owner, FAKE_BLOCKHASH);
    expect(txs).toHaveLength(1);
    expect(txs[0]).toBeInstanceOf(VersionedTransaction);
    expect(txs[0].serialize().length).toBeLessThan(PHANTOM_SAFE_SIZE_LIMIT);
  });

  it('case 3 · 24 个 ATA → 1 笔(在 SPEC 期望 24-30 装得下范围)', () => {
    const txs = buildBatchCloseAccountTxs(gen(24), owner, FAKE_BLOCKHASH);
    expect(txs).toHaveLength(1);
    expect(txs[0].serialize().length).toBeLessThanOrEqual(PHANTOM_SAFE_SIZE_LIMIT);
  });

  it('case 4 · 30 个 ATA → 1-2 笔(临界 · 拆与不拆都接受)', () => {
    const txs = buildBatchCloseAccountTxs(gen(30), owner, FAKE_BLOCKHASH);
    expect(txs.length).toBeGreaterThanOrEqual(1);
    expect(txs.length).toBeLessThanOrEqual(2);
    for (const t of txs) {
      expect(t.serialize().length).toBeLessThanOrEqual(PHANTOM_SAFE_SIZE_LIMIT);
    }
  });

  it('case 5 · 100 个 ATA → ≥ 3 笔 · 每笔 ≤ 1150 字节', () => {
    const txs = buildBatchCloseAccountTxs(gen(100), owner, FAKE_BLOCKHASH);
    expect(txs.length).toBeGreaterThanOrEqual(3);
    for (const t of txs) {
      expect(t.serialize().length).toBeLessThanOrEqual(PHANTOM_SAFE_SIZE_LIMIT);
    }
    // 总 ix 数量 = targets 数(每个 ATA 1 ix · 没丢)
    let totalIxs = 0;
    for (const t of txs) {
      totalIxs += t.message.compiledInstructions.length;
    }
    expect(totalIxs).toBe(100);
  });
});

describe('buildBatchCloseAccountTxs · Token-2022 混合', () => {
  const owner = Keypair.generate().publicKey;

  it('mixed classic + Token-2022 ATAs → 不同 programId 各自正确拼到 ix', () => {
    const targets: CloseTarget[] = [
      { ata: Keypair.generate().publicKey },
      { ata: Keypair.generate().publicKey, programId: TOKEN_2022_PROGRAM_ID },
      { ata: Keypair.generate().publicKey },
    ];
    const txs = buildBatchCloseAccountTxs(targets, owner, FAKE_BLOCKHASH);
    expect(txs).toHaveLength(1);
    // staticAccountKeys 应含两个 program id(classic + Token-2022)
    const keys = txs[0].message.staticAccountKeys.map((k) => k.toBase58());
    expect(keys).toContain(TOKEN_PROGRAM_ID.toBase58());
    expect(keys).toContain(TOKEN_2022_PROGRAM_ID.toBase58());
  });
});

describe('buildBatchCloseAccountTxs · blockhash 透传', () => {
  it('每笔 tx 用同一 blockhash(调用方负责 fresh)', () => {
    const owner = Keypair.generate().publicKey;
    // 用 Keypair.publicKey 作 32-byte 来源 · 转 base58 取合法 blockhash 字符串
    const bh = Keypair.generate().publicKey.toBase58();
    const txs = buildBatchCloseAccountTxs(gen(50), owner, bh);
    for (const t of txs) {
      expect(t.message.recentBlockhash).toBe(bh);
    }
  });
});
