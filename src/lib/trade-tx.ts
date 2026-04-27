/**
 * 交易执行 + 成交回溯
 *
 * 流程:
 * 1. 反序列化 Jupiter 给的交易字节(base64 → VersionedTransaction)
 * 2. 调 wallet adapter 的 signTransaction(Phantom/OKX 弹窗)
 * 3. 广播到 Solana 节点(Helius RPC)
 * 4. 轮询 getSignatureStatuses 等确认
 * 5. getTransaction 读真实 meta → 实际收到 tokens / 消耗 SOL / 网络费
 */
import {
  Connection,
  VersionedTransaction,
  TransactionSignature,
  PublicKey,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';

/** 反序列化 Jupiter swapTransaction base64 字节 */
export function decodeSwapTx(base64: string): VersionedTransaction {
  const raw = Buffer.from(base64, 'base64');
  return VersionedTransaction.deserialize(raw);
}

export interface SignAndSendOptions {
  /** 跳过本地预模拟。自组 tx 已在 build 阶段校验,可设 true 减一次 RPC 来回。default false */
  skipPreflight?: boolean;
  /** 网络抖动(503/fetch fail)重试次数。blockhash 类错误不重试(避免 OKX 双签风控)。default 1 */
  networkRetries?: number;
}

/**
 * 直接签名 + 广播已构造好的 VersionedTransaction(新路径,配合 swap-with-fee)
 *
 * 错误分流:
 *  - blockhash 失效 / block height exceeded → 直接抛(让 friendly-error 翻译为 __ERR_BLOCKHASH_EXPIRED)
 *  - 其他网络错误(503 / fetch fail / TLS 抖动)→ 等 500-1000ms jitter 后重试,最多 networkRetries 次
 *  - 所有重试用同一份已签名 raw bytes,不重新签(避免 OKX 风控对短时间多签敏感)
 */
export async function signAndSendTx(
  connection: Connection,
  wallet: WalletContextState,
  tx: VersionedTransaction,
  opts: SignAndSendOptions = {}
): Promise<TransactionSignature> {
  if (!wallet.signTransaction) {
    throw new Error('钱包不支持 signTransaction');
  }
  const skipPreflight = opts.skipPreflight ?? false;
  const networkRetries = opts.networkRetries ?? 1;

  const signed = await wallet.signTransaction(tx);
  const raw = signed.serialize();

  let lastErr: unknown;
  for (let attempt = 0; attempt <= networkRetries; attempt++) {
    try {
      return await connection.sendRawTransaction(raw, {
        skipPreflight,
        maxRetries: 3,
      });
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // blockhash 类错误重试无意义(同一签名 + 同一 blockhash 重发还是过期)
      if (/blockhash/i.test(msg) || /block\s*height/i.test(msg)) {
        throw e;
      }
      if (attempt < networkRetries) {
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** 钱包签名 + 广播 + 等上链(旧路径,base64 输入) */
export async function signAndSend(
  connection: Connection,
  wallet: WalletContextState,
  swapTxBase64: string,
  opts?: SignAndSendOptions
): Promise<TransactionSignature> {
  return signAndSendTx(connection, wallet, decodeSwapTx(swapTxBase64), opts);
}

/**
 * 等链上确认(默认 60 秒超时)
 *
 * 60s 内每 2s 查 getSignatureStatuses(searchTransactionHistory:false,快路径)
 * 超时未拿到 → 兜底再查一次 searchTransactionHistory:true(慢路径但全),
 *   防止 RPC 节点漏 polling 导致误报"未确认"实际已上链
 */
export async function confirmTx(
  connection: Connection,
  signature: TransactionSignature,
  timeoutMs = 60_000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { value } = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: false,
      });
      const s = value[0];
      if (s) {
        if (s.err) throw new Error('链上交易失败: ' + JSON.stringify(s.err));
        if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') {
          return true;
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('链上交易失败')) throw e;
      // 其他错误继续重试
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  // 超时兜底:用 searchTransactionHistory:true 再查一次
  try {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const s = value[0];
    if (s) {
      if (s.err) throw new Error('链上交易失败: ' + JSON.stringify(s.err));
      if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') {
        return true;
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('链上交易失败')) throw e;
  }
  return false;
}

export interface TxAnalysis {
  feeSol: number;             // 网络 gas + priority fee(signer 付的)
  solDelta: number;           // signer SOL 变化(正=收到,负=花掉;已含 fee)
  tokenDelta: number;         // 目标 mint 的 uiAmount 变化(正=买入,负=卖出)
}

/**
 * 单次 attempt 失败后等待时长(ms)· 指数退避
 * 总 attempts = RETRY_DELAYS_MS.length + 1 = 3 次(首次 + 2 次重试)
 * 总最坏等待 = 500 + 1500 = 2000ms,加 attempts 自身耗时
 */
const ANALYZE_RETRY_DELAYS_MS = [500, 1500] as const;

/** 4xx / 鉴权类错误立即放弃,其余(5xx / network / timeout / 未知)重试 */
function isRetryableAnalyzeError(msg: string): boolean {
  if (/\b4\d{2}\b/.test(msg)) return false;
  if (/unauthorized|forbidden|invalid.*api.*key/i.test(msg)) return false;
  return true;
}

/** ±25% jitter,防多请求同步打 RPC */
function jitterMs(ms: number, pct = 0.25): number {
  return Math.max(0, Math.floor(ms + (Math.random() * 2 - 1) * ms * pct));
}

/**
 * 读取成交后的真实变化量
 *
 * 重试策略(参考后端 T-005 commit 1bbb971):
 *  - 默认 3 次 attempts(首次 + 2 次重试),间隔 500ms / 1500ms ± 25% jitter
 *  - null 返回(RPC indexer 还没处理)→ 等待重试
 *  - 5xx / network / timeout → 重试
 *  - 4xx / 鉴权错 → 立即放弃返 null
 *  - 全部 attempts 失败 → 返 null(向后兼容,fee-tracker / 积分上报会用 quote 估值兜底)
 *
 * 传 signature + 你的 pubkey + 目标 mint → 返回真实数字 / null
 */
export async function analyzeTx(
  connection: Connection,
  signature: TransactionSignature,
  owner: PublicKey,
  mint: string,
  retries: number = ANALYZE_RETRY_DELAYS_MS.length + 1
): Promise<TxAnalysis | null> {
  let tx: ParsedTransactionWithMeta | null = null;
  let lastErrMsg = '';

  for (let i = 0; i < retries; i++) {
    try {
      tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (tx) break;
      // null 返回 = RPC 还没 index,继续 retry(不算错误)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErrMsg = msg;
      if (!isRetryableAnalyzeError(msg)) {
        console.warn('[analyzeTx] non-retryable error, aborting:', msg);
        return null;
      }
      console.warn(`[analyzeTx] attempt ${i + 1}/${retries} failed:`, msg);
    }
    if (i < retries - 1) {
      const baseDelay =
        ANALYZE_RETRY_DELAYS_MS[Math.min(i, ANALYZE_RETRY_DELAYS_MS.length - 1)];
      await new Promise((r) => setTimeout(r, jitterMs(baseDelay)));
    }
  }
  if (!tx || !tx.meta) {
    if (lastErrMsg) {
      console.warn(`[analyzeTx] gave up after ${retries} attempts:`, lastErrMsg);
    }
    return null;
  }

  const meta = tx.meta;
  const feeSol = (meta.fee ?? 0) / 1e9;

  // 找 signer 在 accountKeys 里的位置
  const keys = tx.transaction.message.accountKeys;
  const signerIdx = keys.findIndex((k) => k.pubkey.toBase58() === owner.toBase58());
  const pre = meta.preBalances[signerIdx] ?? 0;
  const post = meta.postBalances[signerIdx] ?? 0;
  const solDelta = (post - pre) / 1e9;

  // token delta
  const findUi = (bal: typeof meta.preTokenBalances) => {
    if (!bal) return 0;
    for (const b of bal) {
      if (b.mint === mint && b.owner === owner.toBase58()) {
        return Number(b.uiTokenAmount.uiAmount ?? 0);
      }
    }
    return 0;
  };
  const preTok = findUi(meta.preTokenBalances);
  const postTok = findUi(meta.postTokenBalances);

  return {
    feeSol,
    solDelta,
    tokenDelta: postTok - preTok,
  };
}

/** 获取 token 的 decimals(Jupiter 报价的 outAmount 是原子单位,要转回 ui 数量) */
export async function getDecimals(
  connection: Connection,
  mint: string
): Promise<number> {
  const pk = new PublicKey(mint);
  const res = await connection.getParsedAccountInfo(pk);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = res.value?.data;
  if (data && 'parsed' in data) {
    return data.parsed.info?.decimals ?? 9;
  }
  return 9;
}
