import { describe, it, expect } from 'vitest';

/**
 * T-503a `safeText` regex 实证锁定 · BUG-021
 *
 * 背景:T-007d 静态审查我把 `dex-pairs.ts:61` 的 `/[ -]/g` regex 标为 BUG-021。
 * Tech Lead 怀疑是 false positive,要求实证。
 *
 * `safeText` 是 module 内 private 函数,无法直接 import。**本文件复制 regex 到测试**,
 * 用 evidence 锁定真相,任何未来 reviewer(包括 AI agent)都能 1 分钟内重新 run
 * 测试看到答案,**不再误判**。
 *
 * 实证结论(2026-04-27 · node REPL 实测过):
 * - `/[ -]/g` 字符类内,`-` 紧贴 `]` 是 literal(不是 range)
 * - **只匹配 2 个字符**:空格(U+0020)和减号(U+002D)
 * - NOT 删:字母 / 数字 / 标点(! " # ... ,)/ 句号 / 括号 / 控制字符 / Unicode
 * - dex-pairs.ts 漏了 ` -` 字面字符串
 *   (`token-search-combo.tsx:323` 是正确版,删控制字符 + DEL)
 * - **BUG-021 真存在,不是 false positive**:
 *   - `'Wrapped SOL'` -> `'WrappedSOL'`(空格被吞 — DexScreener name 字段失真)
 *   - `'USDC-spl'`    -> `'USDCspl'`(减号被吞 — pair symbol 失真)
 *   - `'ABC\x01'`    -> `'ABC\x01'`(控制字符 NOT 被剥 — 安全防御失效)
 *
 * 修复:dex-pairs.ts:61 改 `/[ -]/g` -> 跟 token-search-combo 一致的控制字符 regex。
 *
 * 我之前 BUG-021 报告里说"删 14 个 ASCII 标点"是过度泛化(实测只删 2 个),
 * BUG 性质成立但范围比报告窄。详 qa.md。
 */

// ── 从 dex-pairs.ts:61 复制(任何对该 regex 的修改请同步本测试) ──
const SAFE_TEXT_REGEX = /[ -]/g;

function safeTextLocal(s: string, max = 32): string {
  return s.replace(SAFE_TEXT_REGEX, '').slice(0, max);
}

describe('safeText regex · BUG-021 真相锁定', () => {
  describe('regex 字符匹配集合 · 单字符级', () => {
    it('匹配空格 U+0020', () => {
      expect(/[ -]/.test(' ')).toBe(true);
    });
    it('匹配减号 U+002D', () => {
      expect(/[ -]/.test('-')).toBe(true);
    });

    // ── 以下应不匹配 ──
    it('NOT 匹配 0x21-0x2C 标点(! " # $ % & \' ( ) * + ,)— `-` 是 literal 不是 range', () => {
      // 这条原本是我误判 BUG-021 时认为的"应该 14 个全删",实证只删 2 个
      const punct = '!"#$%&\'()*+,';
      for (const ch of punct) {
        expect(/[ -]/.test(ch)).toBe(false);
      }
    });
    it('NOT 匹配字母 a/Z', () => {
      expect(/[ -]/.test('a')).toBe(false);
      expect(/[ -]/.test('Z')).toBe(false);
    });
    it('NOT 匹配数字 0-9', () => {
      for (const ch of '0123456789') {
        expect(/[ -]/.test(ch)).toBe(false);
      }
    });
    it('NOT 匹配句号 .', () => {
      expect(/[ -]/.test('.')).toBe(false);
    });
    it('NOT 匹配 ASCII 控制字符 \\x01(BUG-021:期望应删,实际不删)', () => {
      expect(/[ -]/.test('\x01')).toBe(false);
    });
    it('NOT 匹配 DEL \\x7F', () => {
      expect(/[ -]/.test('\x7f')).toBe(false);
    });
    it('NOT 匹配 Unicode 中文', () => {
      expect(/[ -]/.test('代')).toBe(false);
    });
  });

  describe('safeText 端到端 · DexScreener 真实输入示例', () => {
    it("'Wrapped SOL' -> 'WrappedSOL'(空格被吞 · BUG-021 真 bug · DexScreener name 字段失真)", () => {
      expect(safeTextLocal('Wrapped SOL')).toBe('WrappedSOL');
      // 期望(BUG-021 修后):'Wrapped SOL'
    });

    it("'USDC-spl' -> 'USDCspl'(减号被吞 · BUG-021 真 bug · pair symbol 失真)", () => {
      expect(safeTextLocal('USDC-spl')).toBe('USDCspl');
      // 期望(BUG-021 修后):'USDC-spl'
    });

    it("'ABC\\x01' -> 'ABC\\x01'(控制字符 NOT 被剥 · BUG-021 真 bug · 安全防御失效)", () => {
      expect(safeTextLocal('ABC\x01')).toBe('ABC\x01');
      // 期望(BUG-021 修后):'ABC'(剥控制字符,跟 token-search-combo 对齐)
    });

    it("'Pump.fun' -> 'Pump.fun'(没空格没减号,通过)", () => {
      expect(safeTextLocal('Pump.fun')).toBe('Pump.fun');
    });

    it("'(USDC pair)' -> '(USDCpair)'(只删空格,括号保留 — 实测纠正之前的 14 字符泛化误判)", () => {
      expect(safeTextLocal('(USDC pair)')).toBe('(USDCpair)');
    });

    it('slice(32) 工作 · 长字符串截断', () => {
      const long = 'A'.repeat(50);
      expect(safeTextLocal(long).length).toBe(32);
    });

    it('全空格输入 -> 空字符串', () => {
      expect(safeTextLocal('   ')).toBe('');
    });

    it('混合 Unicode + ASCII 标点 + 控制字符', () => {
      // 输入: '代币 - test\x01' (中文 + 空格 + 减号 + 空格 + ASCII + 控制字符)
      // 当前 broken: 删空格(2 个) + 减号(1 个),保留 \x01
      expect(safeTextLocal('代币 - test\x01')).toBe('代币test\x01');
      // 期望(BUG-021 修后):'代币 - test'(剥 \x01,保空格减号)
    });
  });
});

describe('参照对比 · token-search-combo.tsx:323 是正确实现', () => {
  // 从 token-search-combo.tsx:322-323 复制(已是正确写法,作为对照基准)
  // 注意:此处用 String.raw 拼出 4 字符 escape,避免文件含真实控制字节(让 Git 误判 binary)
  // eslint-disable-next-line no-control-regex
  const CORRECT_REGEX = new RegExp(String.raw`[\x00-\x1f\x7f]`, 'g');

  it('正确版:删 \\x01,保留空格', () => {
    expect('A B\x01'.replace(CORRECT_REGEX, '')).toBe('A B');
  });

  it('正确版:保留减号', () => {
    expect('USDC-spl'.replace(CORRECT_REGEX, '')).toBe('USDC-spl');
  });

  it('正确版:保留空格', () => {
    expect('Wrapped SOL'.replace(CORRECT_REGEX, '')).toBe('Wrapped SOL');
  });

  it('两版 regex 应用到同一字符串,结果不同 · BUG-021 直接证据', () => {
    const sample = 'Wrapped SOL\x01-end';
    const broken = sample.replace(SAFE_TEXT_REGEX, '');
    const correct = sample.replace(CORRECT_REGEX, '');
    expect(broken).not.toBe(correct);
    // dex-pairs.ts 当前(broken):'WrappedSOL\x01end'(删空格 + 减号,保留 \x01)
    expect(broken).toBe('WrappedSOL\x01end');
    // 应该(correct):'Wrapped SOL-end'(剥 \x01,保空格 + 减号)
    expect(correct).toBe('Wrapped SOL-end');
  });
});
