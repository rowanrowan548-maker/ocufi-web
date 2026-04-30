/**
 * T-ONCHAIN-QUOTE-PERSIST · swap 时落 Jupiter quote 到 localStorage
 *
 * 用途:
 *   /history 滑点列要算"真滑点":(quote_out - actual_out) / quote_out * 10000 bps
 *   - quote_out:Jupiter quote 给的 outAmount(swap 前预期收到)
 *   - actual_out:链上实际收到(后端 tx-detail 已能给)
 *   两个数字之差 = 实际滑点(跟"用户设的 max 容忍滑点"是两个概念)
 *
 * 存储设计:
 *   - 每笔 swap 一个 key:`ocufi:quote:<swapTxSig>` · 不塞大数组(读写慢 + 易冲突)
 *   - 索引 key `ocufi:quote-index` 存 `{signature, timestamp}[]` · 启动时清 30 天前
 *
 * 保留 30 天:够 /history 默认 30 天窗口 · 不会无限堆 storage
 *
 * V1 纯前端 · 不传后端(后端目前没字段表 · 用户决策 2026-04-30)· 多设备不同步可接受。
 */

const QUOTE_KEY_PREFIX = 'ocufi:quote:';
const INDEX_KEY = 'ocufi:quote-index';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000; // 30 天
const MAX_INDEX_SIZE = 1000; // 防恶意 / bug 失控膨胀 · 超出按最旧裁剪

export interface StoredSwapQuote {
  /** swap tx 链上 signature(split 模式 = 第 2 笔 swap tx 的 sig)*/
  signature: string;
  /** 落地时间(epoch ms)*/
  timestamp: number;
  /** 输入 mint(buy 时 = SOL · sell 时 = 卖的 SPL)*/
  inputMint: string;
  /** 输出 mint(buy 时 = 买的 SPL · sell 时 = SOL)*/
  outputMint: string;
  /** 输入数量(lamports / token base 单位 · raw string)*/
  inputAmount: string;
  /** Jupiter 给的 outAmount · /history 算滑点的"分母"*/
  quoteOutAmount: string;
  /** 用户设的 max 容忍滑点 bps(供 /history 显式区分"max 滑点 vs 真滑点")*/
  slippageBps: number;
  /** buy 还是 sell · /history UI 渲染区分 */
  side: 'buy' | 'sell';
}

const isClient = () => typeof window !== 'undefined';

interface IndexEntry {
  signature: string;
  timestamp: number;
}

function readIndex(): IndexEntry[] {
  if (!isClient()) return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 防御:过滤掉脏数据
    return parsed.filter(
      (e): e is IndexEntry =>
        e &&
        typeof e.signature === 'string' &&
        typeof e.timestamp === 'number' &&
        Number.isFinite(e.timestamp)
    );
  } catch {
    return [];
  }
}

function writeIndex(entries: IndexEntry[]): void {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    // localStorage 满 / 禁用 · 静默 · 索引丢只是失去 prune 能力 · 不阻塞 swap
  }
}

function quoteKey(signature: string): string {
  return `${QUOTE_KEY_PREFIX}${signature}`;
}

/**
 * 落地一笔 swap 的 Jupiter quote
 *
 * 调用方:execute-swap-plan.ts 拿到 swap tx sig 后(single / split 都在 swap 笔后)
 * 失败行为:静默(localStorage 满 / 禁用 / SSR)· 不抛 · 不阻塞 swap 流程
 */
export function saveSwapQuote(quote: StoredSwapQuote): void {
  if (!isClient()) return;
  if (!quote.signature) return; // 防御:sig 必须存在
  try {
    window.localStorage.setItem(quoteKey(quote.signature), JSON.stringify(quote));
    // 更新索引(如果同 sig 已在,先去掉旧条目再 push)
    const idx = readIndex().filter((e) => e.signature !== quote.signature);
    idx.push({ signature: quote.signature, timestamp: quote.timestamp });
    // 索引超大裁剪
    if (idx.length > MAX_INDEX_SIZE) {
      idx.sort((a, b) => a.timestamp - b.timestamp);
      const removed = idx.splice(0, idx.length - MAX_INDEX_SIZE);
      for (const r of removed) {
        try {
          window.localStorage.removeItem(quoteKey(r.signature));
        } catch {
          /* ignore */
        }
      }
    }
    writeIndex(idx);
  } catch {
    // localStorage 满 / 禁用 · 静默
  }
}

/**
 * 读一笔 swap 的 quote · 找不到返 null(老交易 / 跨设备 / 已 prune)
 *
 * 调用方:/history 渲染滑点列 · 单元 row 调一次 · 找不到显 dash 不爆错
 */
export function loadSwapQuote(signature: string): StoredSwapQuote | null {
  if (!isClient()) return null;
  if (!signature) return null;
  try {
    const raw = window.localStorage.getItem(quoteKey(signature));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 防御:校验 shape · 损坏的条目当不存在
    if (
      !parsed ||
      typeof parsed.signature !== 'string' ||
      typeof parsed.timestamp !== 'number' ||
      typeof parsed.quoteOutAmount !== 'string' ||
      typeof parsed.inputAmount !== 'string' ||
      typeof parsed.inputMint !== 'string' ||
      typeof parsed.outputMint !== 'string' ||
      (parsed.side !== 'buy' && parsed.side !== 'sell')
    ) {
      return null;
    }
    return parsed as StoredSwapQuote;
  } catch {
    return null;
  }
}

/**
 * 清 30 天前的 quote(启动时调一次即可)
 *
 * 性能:索引最多 1000 条 · O(N) 扫一遍 + N 次 removeItem · ~ms 级 · 不影响首屏
 * 调用方:_app 或 layout 顶层 · useEffect once
 */
export function pruneOldQuotes(): void {
  if (!isClient()) return;
  try {
    const idx = readIndex();
    if (idx.length === 0) return;
    const cutoff = Date.now() - MAX_AGE_MS;
    const fresh: IndexEntry[] = [];
    const stale: IndexEntry[] = [];
    for (const e of idx) {
      if (e.timestamp < cutoff) stale.push(e);
      else fresh.push(e);
    }
    if (stale.length === 0) return;
    for (const s of stale) {
      try {
        window.localStorage.removeItem(quoteKey(s.signature));
      } catch {
        /* ignore */
      }
    }
    writeIndex(fresh);
  } catch {
    // 任何异常 · 静默 · prune 不影响主流程
  }
}
