/**
 * Jupiter Trigger API(限价单,原 Limit Order v2)封装
 *
 * 端点:https://lite-api.jup.ag/trigger/v1/*
 *
 * 语义:maker 愿意用 makingAmount 的 inputMint 换 takingAmount 的 outputMint,
 *       价格 = takingAmount / makingAmount(按小数精度换算)
 *
 * 最小订单:$5 USD 起,低于会被拒(error code 1)
 */

export interface CreateOrderParams {
  inputMint: string;
  outputMint: string;
  maker: string;          // 用户 pubkey
  payer: string;          // 付 rent 的 pubkey(通常同 maker)
  makingAmount: string;   // raw amount(含精度)
  takingAmount: string;   // raw amount(含精度)
  /** Unix 秒,可选 */
  expiredAt?: string;
  /** 可选 referral(我们自己收 fee 可用,MVP 先不带) */
  feeAccount?: string;
  feeBps?: number;
}

export interface CreateOrderResponse {
  order: string;              // 订单 account address
  transaction: string;        // base64 VersionedTransaction 给用户签
  requestId: string;
}

export async function createTriggerOrder(
  p: CreateOrderParams
): Promise<CreateOrderResponse> {
  const body = {
    inputMint: p.inputMint,
    outputMint: p.outputMint,
    maker: p.maker,
    payer: p.payer,
    params: {
      makingAmount: p.makingAmount,
      takingAmount: p.takingAmount,
      ...(p.expiredAt ? { expiredAt: p.expiredAt } : {}),
      ...(p.feeBps ? { feeBps: String(p.feeBps) } : {}),
    },
    ...(p.feeAccount ? { feeAccount: p.feeAccount } : {}),
  };
  const res = await fetch('https://lite-api.jup.ag/trigger/v1/createOrder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`createOrder ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as CreateOrderResponse;
}

export interface CancelOrderParams {
  maker: string;
  order: string;       // 订单 account address
}

export interface CancelOrderResponse {
  transaction: string; // base64 需用户签名
  requestId: string;
}

export async function cancelTriggerOrder(
  p: CancelOrderParams
): Promise<CancelOrderResponse> {
  const res = await fetch('https://lite-api.jup.ag/trigger/v1/cancelOrder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maker: p.maker, order: p.order }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`cancelOrder ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as CancelOrderResponse;
}

/**
 * Jupiter Trigger API 真实返回字段(来自 /getTriggerOrders 实测):
 * - makingAmount / takingAmount:**已格式化 ui 字符串**(如 "0.07"、"70000")
 * - rawMakingAmount / rawTakingAmount:真正的 lamports/原子单位 string
 * - expiredAt / createdAt:ISO 8601 字符串("2026-04-25T18:26:01Z")
 * - status:Open / Cancelled / Filled / Expired(首字母大写)
 * - userPubkey(不是 "maker")
 */
export interface TriggerOrder {
  userPubkey: string;
  orderKey: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
  remainingMakingAmount: string;
  remainingTakingAmount: string;
  rawMakingAmount: string;
  rawTakingAmount: string;
  slippageBps?: string;
  expiredAt?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'Open' | 'Cancelled' | 'Filled' | 'Expired' | string;
  openTx?: string;
  closeTx?: string;
}

export interface OrdersResponse {
  orders: TriggerOrder[];
  totalPages: number;
  page: number;
  totalItems: number;
}

export async function getTriggerOrders(
  user: string,
  status: 'active' | 'history' = 'active',
  page = 1
): Promise<OrdersResponse> {
  const params = new URLSearchParams({
    user,
    orderStatus: status,
    page: String(page),
  });
  const res = await fetch(
    `https://lite-api.jup.ag/trigger/v1/getTriggerOrders?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getTriggerOrders ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as OrdersResponse;
}
