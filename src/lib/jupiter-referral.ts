/**
 * Jupiter Referral fee account PDA 派生
 *
 * Jupiter 收 platform fee 的目标不是 Referral Account 主地址(钱包级 PDA),
 * 而是主地址 + input mint 两个 seed 派生出来的 **Referral Token ATA**。
 *
 * 用户在 https://referral.jup.ag/dashboard "Create Token Accounts" 时
 * 预先为某些 mint 创建了这些 ATA — 只有已创建的 ATA 能接收 fee,
 * 未创建的 mint 上送交易 Jupiter 会构造出失败的 tx(转账到不存在的账户)
 *
 * 所以:
 *  1. 按 input mint 派生 fee ATA PDA
 *  2. 只有当 input mint 在"已开通"白名单里才带 feeAccount + platformFeeBps
 *  3. 其余情况跳过收费(避免交易失败 >> 多赚那 0.1%)
 */
import { PublicKey } from '@solana/web3.js';

// Jupiter 官方 Referral Program ID(固定值)
export const JUPITER_REFERRAL_PROGRAM = new PublicKey(
  'REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3'
);

/**
 * 当前 Referral Account 下已开通 ATA 的 mint 白名单
 * 用户在 Referral Dashboard 勾过哪些,这里就维护哪些
 */
export const FEE_SUPPORTED_MINTS = new Set<string>([
  'So11111111111111111111111111111111111111112',  // WSOL (SOL)
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  // USD1 暂不支持:mint 未确认,等补上后加入
]);

/** 从 NEXT_PUBLIC_JUPITER_FEE_ACCOUNT(Referral Account 主地址)派生对应 input mint 的 fee ATA PDA */
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

/**
 * 综合:按 input mint 决定是否带 feeAccount
 * 返回 { feeAccount, platformFeeBps }
 *
 * ⚠️ 紧急关闭:PDA 派生疑似和 Jupiter 实际 accountant 不一致,
 *    导致 OKX 钱包预模拟失败。需要完整对接 @jup-ag/referral-sdk
 *    确认 seeds 顺序。在调好之前先 100% 走 0 bps,优先保用户能交易
 */
const FEE_DISABLED = true;

export function resolveFee(inputMint: string): {
  feeAccount?: string;
  platformFeeBps: number;
} {
  if (FEE_DISABLED) return { platformFeeBps: 0 };

  const main = process.env.NEXT_PUBLIC_JUPITER_FEE_ACCOUNT;
  if (!main) return { platformFeeBps: 0 };
  if (!FEE_SUPPORTED_MINTS.has(inputMint)) return { platformFeeBps: 0 };
  const feeAccount = deriveReferralFeeAccount(main, inputMint);
  if (!feeAccount) return { platformFeeBps: 0 };
  return { feeAccount, platformFeeBps: 10 };
}
