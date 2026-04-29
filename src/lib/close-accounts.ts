/**
 * SPL Token closeAccount 工具(T-REWARDS-CLOSE-ACCOUNT-TX · 2026-04-30)
 *
 * 背景:
 *   每个 SPL token ATA 占 165 字节链上空间 · 押金约 0.00203928 SOL · 余额 0 时不退还
 *   gmgn / photon 都没自动 close · 用户钱里有几十个 dust ATA · 押金累计几十块美金锁着
 *   Ocufi V1 给 2 个救钱路径:
 *     A. 卖完自动 close(本 lib + swap-with-fee.ts cleanup 改造)· 即时退押金到用户钱包
 *     B. 奖励中心批量回收(本 lib `buildBatchCloseAccountTxs`)· 一键扫所有空 ATA 一键 close
 *
 * 设计要点:
 *   - 不引新 npm dep · 不依赖 @solana/spl-token · CloseAccount 指令格式简单(1 字节 discriminator)直接组
 *   - 同时支持 classic SPL Token + Token-2022(programId 可传)· 默认 classic
 *   - 押金返还到 owner(用户钱包)· 不允许定向其他地址(防 phishing)
 *   - 批量 close 自动按 PHANTOM_SAFE_SIZE_LIMIT(1150 字节)拆多笔 · 测下来 ~25-27 个 ATA / tx
 */
import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from './portfolio';
import {
  PHANTOM_SAFE_SIZE_LIMIT,
  SOLANA_TX_SIZE_LIMIT,
  compileV0Tx,
} from './swap-with-fee';

/** SPL Token CloseAccount instruction discriminator(单字节 · classic + Token-2022 通用) */
const CLOSE_ACCOUNT_INSTRUCTION_DATA = Buffer.from([9]);

/**
 * 构造单个 closeAccount instruction
 *
 * @param ata        要关闭的 token account(余额必须为 0 · 否则链上 reject)
 * @param owner      ATA owner(同时 = 押金返还目的地 · = signer)
 * @param programId  Token Program · classic SPL 或 Token-2022 · default classic
 *
 * Ix layout(SPL Token Program · CloseAccount = 9):
 *   accounts:
 *     0: account to close   [writable]
 *     1: destination        [writable]   (押金返还到这)
 *     2: owner / authority  [signer]
 *   data: [9]                            (单字节 discriminator)
 */
export function createCloseAccountIx(
  ata: PublicKey,
  owner: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: CLOSE_ACCOUNT_INSTRUCTION_DATA,
  });
}

/**
 * 待 close 的 ATA 描述
 *
 * - `ata`:token account pubkey(链上要被 close 的账户)
 * - `programId`:可选 · 默认 TOKEN_PROGRAM_ID(classic)· Token-2022 mint 必须传 TOKEN_2022_PROGRAM_ID
 */
export interface CloseTarget {
  ata: PublicKey;
  programId?: PublicKey;
}

/**
 * 批量 close · 自动按 size 拆多笔
 *
 * 算法:
 *   1. 累加 ix · 每加 1 条试编译 v0 tx · 看序列化 size
 *   2. size > PHANTOM_SAFE_SIZE_LIMIT(1150)→ 切下一笔
 *   3. 单笔超 SOLANA_TX_SIZE_LIMIT(1232)抛错(理论不该发生 · 1 个 closeAccount ~40 字节)
 *
 * 实测每笔 ~25-27 个 ATA(因 staticAccountKeys 共享 + 每个 ata 加 32 字节 + ix 开销 ~7 字节)
 *
 * @returns 多笔 v0 tx · 每笔需 owner 单独签 · 每笔押金按 ATA 数 × ~0.00204 SOL 退到 owner
 *
 * 边界:
 *   - targets 空 → 返 [](调用方判断后不 send)
 *   - 单 target ata 实际余额非 0 → 链上 reject(本 lib 不预校验 · 调用方先调 backend `/portfolio/empty-accounts` 拿过滤好的列表)
 */
export function buildBatchCloseAccountTxs(
  targets: CloseTarget[],
  owner: PublicKey,
  blockhash: string
): VersionedTransaction[] {
  if (targets.length === 0) return [];

  const txs: VersionedTransaction[] = [];
  const alts: AddressLookupTableAccount[] = []; // close 不需要 ALT(owner / token program / N 个 ATA 都直放 staticAccountKeys)
  let bucket: TransactionInstruction[] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const ix = createCloseAccountIx(t.ata, owner, t.programId);
    const tentative = [...bucket, ix];
    const tentativeTx = compileV0Tx(owner, blockhash, tentative, alts);
    const size = tentativeTx.serialize().length;

    if (size > PHANTOM_SAFE_SIZE_LIMIT && bucket.length > 0) {
      // 切笔 · 当前桶不带 ix 提交 · ix 进新桶
      const settled = compileV0Tx(owner, blockhash, bucket, alts);
      txs.push(settled);
      bucket = [ix];
      continue;
    }

    // 单 ix 一上来就超 1232:理论不发生 · close ix ~40 字节 · 防御性抛错
    if (size > SOLANA_TX_SIZE_LIMIT) {
      throw new Error(
        `__ERR_CLOSE_ACCOUNT_TX_OVERSIZE(single close ix tx > ${SOLANA_TX_SIZE_LIMIT} · should never happen)`
      );
    }

    bucket = tentative;
  }

  if (bucket.length > 0) {
    txs.push(compileV0Tx(owner, blockhash, bucket, alts));
  }

  return txs;
}
