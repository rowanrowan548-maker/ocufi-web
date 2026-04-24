/**
 * Jupiter Referral fee account PDA 派生
 *
 * Jupiter 平台 fee 发送到 Referral Token Account(V1 版):
 *   PDA = findProgramAddress(['referral_ata', referralMainAccount, mint], REFERRAL_PROGRAM)
 * 用户在 https://referral.jup.ag/dashboard 为某些 mint 预创建了这些 ATA,
 * 只有已创建的 mint 能收 fee;未创建的必须跳过 fee 否则 Jupiter 构造的 tx 失败。
 *
 * V1 vs V2 SDK 区分(@jup-ag/referral-sdk 0.3.0):
 *  - V1: custom PDA with seeds 'referral_ata' + ref + mint → 非标准 SPL ATA,但 Jupiter Swap v1
 *        `feeAccount` 参数默认支持这种
 *  - V2: 标准 Associated Token Account(owner = ref 主地址),新式,但用户 Dashboard 创建的是 V1
 *
 * 沙盒脚本(scripts/sandbox-fee,本地 simulateTransaction)验证:
 *  ✅ V1 能通过
 *  ❌ V2 失败(0x1789 InvalidFeeAccount,因为用户没创建 V2 ATA)
 * 所以我们用 V1。
 */
import { PublicKey } from '@solana/web3.js';

export const JUPITER_REFERRAL_PROGRAM = new PublicKey(
  'REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3'
);

/** 用户在 Referral Dashboard 为这些 mint 勾了 "Create Token Accounts" */
export const FEE_SUPPORTED_MINTS = new Set<string>([
  'So11111111111111111111111111111111111111112',  // WSOL (SOL)
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  // USD1 暂不支持:mint 未确认
]);

/** V1 派生:findProgramAddress 同 SDK `getReferralTokenAccountPubKey` */
export function deriveReferralFeeAccount(
  referralMainAccount: string,
  inputMint: string
): string | undefined {
  try {
    const referralPk = new PublicKey(referralMainAccount);
    const mintPk = new PublicKey(inputMint);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('referral_ata'), referralPk.toBuffer(), mintPk.toBuffer()],
      JUPITER_REFERRAL_PROGRAM
    );
    return pda.toBase58();
  } catch {
    return undefined;
  }
}

/** 按 input mint 决定是否带 feeAccount(未开通 ATA 的 mint 返回 0 bps 保交易成功) */
export function resolveFee(inputMint: string): {
  feeAccount?: string;
  platformFeeBps: number;
} {
  const main = process.env.NEXT_PUBLIC_JUPITER_FEE_ACCOUNT;
  if (!main) return { platformFeeBps: 0 };
  if (!FEE_SUPPORTED_MINTS.has(inputMint)) return { platformFeeBps: 0 };
  const feeAccount = deriveReferralFeeAccount(main, inputMint);
  if (!feeAccount) return { platformFeeBps: 0 };
  return { feeAccount, platformFeeBps: 10 };
}
