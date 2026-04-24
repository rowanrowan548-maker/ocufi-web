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

/** 直接签名 + 广播已构造好的 VersionedTransaction(新路径,配合 swap-with-fee) */
export async function signAndSendTx(
  connection: Connection,
  wallet: WalletContextState,
  tx: VersionedTransaction
): Promise<TransactionSignature> {
  if (!wallet.signTransaction) {
    throw new Error('钱包不支持 signTransaction');
  }
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  return sig;
}

/** 钱包签名 + 广播 + 等上链(旧路径,base64 输入) */
export async function signAndSend(
  connection: Connection,
  wallet: WalletContextState,
  swapTxBase64: string
): Promise<TransactionSignature> {
  return signAndSendTx(connection, wallet, decodeSwapTx(swapTxBase64));
}

/** 等链上确认(默认 60 秒超时) */
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
  return false;
}

export interface TxAnalysis {
  feeSol: number;             // 网络 gas + priority fee(signer 付的)
  solDelta: number;           // signer SOL 变化(正=收到,负=花掉;已含 fee)
  tokenDelta: number;         // 目标 mint 的 uiAmount 变化(正=买入,负=卖出)
}

/**
 * 读取成交后的真实变化量
 * 传 signature + 你的 pubkey + 目标 mint → 返回真实数字
 */
export async function analyzeTx(
  connection: Connection,
  signature: TransactionSignature,
  owner: PublicKey,
  mint: string,
  retries = 4
): Promise<TxAnalysis | null> {
  let tx: ParsedTransactionWithMeta | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (tx) break;
    } catch {
      // RPC 可能还没索引到,重试
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!tx || !tx.meta) return null;

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
