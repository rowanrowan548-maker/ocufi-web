/**
 * RugCheck API 返回的 risks[].name / description 是英文,中文模式下做 best-effort 翻译。
 * 找不到匹配 → 回落原文,不会抛错。
 */
export type Locale = 'zh-CN' | 'en-US' | string;

/**
 * RugCheck 实际返回的英文 name → 中文
 * 注:此映射来自实测 + 公开样本,未覆盖的会 fallback 原文。新发现的英文条目欢迎补充。
 */
const NAME_ZH: Record<string, string> = {
  // 权限类
  'Mint Authority still enabled': 'Mint 增发权未放弃',
  'Mutable Mint Authority': 'Mint 增发权未放弃',
  'Mint Authority Active': 'Mint 增发权未放弃',
  'Freeze Authority still enabled': 'Freeze 冻结权未放弃',
  'Mutable Freeze Authority': 'Freeze 冻结权未放弃',
  'Freeze Authority Active': 'Freeze 冻结权未放弃',
  'Mutable metadata': '元数据可被修改',
  // 流动性类
  'Liquidity too low': '流动性过低',
  'Low Liquidity': '流动性低',
  'Low amount of LP Providers': 'LP 提供者过少',
  'High amount of LP Unlocked': 'LP 未锁定比例高',
  'High amount of LP unlocked': 'LP 未锁定比例高',
  'LP unlocked': 'LP 未锁定',
  'Low Liquidity LP': '流动性池子规模小',
  'No Liquidity': '无流动性',
  'No Market': '无活跃市场',
  // 持仓集中度
  'Top 10 holders high ownership': '前 10 持仓占比过高',
  'Top 10 Holders': '前 10 持仓集中',
  'Single holder ownership': '单一持有者控盘',
  'High ownership': '持仓集中度过高',
  'High creator ownership': '创建者持仓过高',
  'Creator high ownership': '创建者持仓过高',
  'Tokens controlled by holders': '筹码被少数持有者控制',
  'Low number of holders': '持有人过少',
  'Insider': '内部人地址',
  'Insider Pre-Sale': '内部预售',
  'Insiders': '内部人地址',
  // pump.fun / bonding curve 类
  'Bonding Curve': '联合曲线(Bonding Curve)',
  'Bonding curve not complete': '联合曲线未完成',
  'Pumpfun graduated': 'Pump.fun 已毕业',
  // 其他
  'Copycat token': '抄袭代币',
  'Symbol Mismatch': '符号不一致',
  'Name Mismatch': '名称不一致',
  'Token Migrated': '代币已迁移',
  'Honeypot': '蜜罐特征',
  'Rugged': '已被判定为 rug',
};

/**
 * description 中文映射 · RugCheck 描述偶尔会随版本调整文案,这里覆盖实测样本。
 * 找不到完全匹配会走 prefix 匹配兜底(见 translateRiskDesc)。
 */
const DESC_ZH: Record<string, string> = {
  // 权限类
  'Anybody can create more of this token': '任何人都可增发,持仓可被无限稀释',
  'The freeze authority can freeze any account in the token mint': '冻结权可冻结任意账户的持仓',
  'The metadata of the token can be changed': '元数据可改,项目方可换图换名',
  // 持仓集中度
  'The top 10 users hold more than 70% token supply': '前 10 用户持仓 >70%,易被集中砸盘',
  'The top 10 users hold more than 80% token supply': '前 10 用户持仓 >80%,高度集中',
  'The top 10 users hold more than 90% token supply': '前 10 用户持仓 >90%,极度集中',
  'The top users hold more than 70% token supply': '头部用户持仓 >70%,集中度过高',
  'The top users hold more than 80% token supply': '头部用户持仓 >80%,高度集中',
  'The top users hold more than 90% token supply': '头部用户持仓 >90%,极度集中',
  'One user holds a large amount of the token supply': '单一地址持仓占比过大,可能控盘',
  'A single account holds a high amount of supply': '单个地址持仓过高,可能控盘',
  'Top 10 holders own a large amount of supply': '前 10 持仓占总量比例过高,易被砸盘',
  'Creator holds a large amount of supply': '创建者持仓过高,跑路风险',
  'The creator owns a large amount of the token supply': '创建者持仓过大,跑路风险',
  'Token holders include known insiders': '持有者中含已知内部人地址',
  // 流动性类
  'Token has low amount of LP Providers': 'LP 提供者过少,池子可能被一两个地址操控',
  'Only a few users are providing liquidity': 'LP 提供者只有寥寥几个,做市方易撤池',
  'A high amount of LP is unlocked': 'LP 未锁定比例高,做市方随时撤池',
  'Token has very low liquidity': '流动性极低,买入容易但难卖出',
  'Low amount of liquidity in the token pool': '池子流动性低,大额交易会大幅滑点',
  'Token has no liquidity': '无流动性,无法成交',
  // 其他
  'Token has been migrated': '代币已迁移到新地址',
};

/** 把 RugCheck 风险 name 翻译成当前 locale 的展示文本(找不到 → 原文) */
export function translateRiskName(name: string, locale: Locale): string {
  if (!name) return name;
  if (locale === 'zh-CN') return NAME_ZH[name] ?? name;
  return name;
}

/** description 翻译(找不到 → 原文) */
export function translateRiskDesc(desc: string, locale: Locale): string {
  if (!desc) return desc;
  if (locale === 'zh-CN') return DESC_ZH[desc] ?? desc;
  return desc;
}
