/**
 * 累计手续费追踪 · localStorage
 *
 * 每笔成交后追加:Ocufi 0.1% + Solana 网络实际 Gas
 * 跨钱包按 owner address 分库,纯前端,不上送
 */
const PREFIX = 'ocufi.fees.';

export interface FeeTotal {
  /** Ocufi 平台收的 SOL 手续费总和 */
  ocufiSol: number;
  /** Solana 网络 Gas 总和 */
  networkSol: number;
  /** 累计成交笔数 */
  txCount: number;
  /** 累计成交体量(SOL,买入端 inputSol + 卖出端 outputSol)· 用于「省下手续费」对比 */
  volumeSol: number;
  /** 第一笔成交时间(ms) */
  startedAt: number;
  /** 最后一笔成交时间(ms) */
  lastAt: number;
}

function key(wallet: string): string {
  return `${PREFIX}${wallet}`;
}

const EMPTY: FeeTotal = {
  ocufiSol: 0, networkSol: 0, txCount: 0, volumeSol: 0, startedAt: 0, lastAt: 0,
};

export function readFees(wallet: string): FeeTotal {
  if (typeof window === 'undefined' || !wallet) return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(key(wallet));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return {
      ocufiSol: Number(parsed.ocufiSol) || 0,
      networkSol: Number(parsed.networkSol) || 0,
      txCount: Number(parsed.txCount) || 0,
      volumeSol: Number(parsed.volumeSol) || 0,
      startedAt: Number(parsed.startedAt) || 0,
      lastAt: Number(parsed.lastAt) || 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function recordFee(
  wallet: string,
  args: { ocufiSol: number; networkSol: number; volumeSol: number },
): FeeTotal {
  if (typeof window === 'undefined' || !wallet) return { ...EMPTY };
  const cur = readFees(wallet);
  const now = Date.now();
  const next: FeeTotal = {
    ocufiSol: cur.ocufiSol + Math.max(0, args.ocufiSol),
    networkSol: cur.networkSol + Math.max(0, args.networkSol),
    txCount: cur.txCount + 1,
    volumeSol: cur.volumeSol + Math.max(0, args.volumeSol),
    startedAt: cur.startedAt || now,
    lastAt: now,
  };
  try {
    window.localStorage.setItem(key(wallet), JSON.stringify(next));
  } catch { /* 满了 / 隐私模式 */ }
  return next;
}
