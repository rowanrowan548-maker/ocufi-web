# Ocufi · Solana 交易终端(Web)

非托管、低手续费、透明、开源的 Solana 链上交易终端。V1 对标 gmgn / bullx / axiom,差异化:

- **手续费 0.2%**(买卖各 0.1%,约为竞品 1/5)
- **非托管**:钱包在用户自己手里(Phantom / Solflare),私钥永不离开浏览器
- **代币安全审查**:前 10 持有者占比 / LP 烧毁 / Mint & Freeze Authority / 创建时间 / 流动性警告
- **开源可审计**:前端代码公开

## 技术栈

- Next.js 16 (App Router + React 19 + Tailwind v4)
- shadcn/ui + TypeScript
- next-intl(i18n,V1 仅中文,架构预留英文)
- @solana/wallet-adapter(Phantom / Solflare 自动发现)
- Jupiter v6 Quote + Swap + Limit Order
- DexScreener + RugCheck + Birdeye(行情与安全数据)

## 架构约定

- **多链预留**:统一走 `src/config/chains.ts`,禁止在业务代码硬编码 `"solana"` 或 Solana 专属 RPC
- **i18n**:所有用户可见文字走 `messages/*.json`,禁止组件内写死中文字面量
- **路由**:App Router + `src/app/[locale]/` 结构,`proxy.ts`(Next.js 16 起 `middleware` 更名)

## 本地开发

```bash
pnpm install
cp .env.example .env.local   # 然后填 Helius RPC 和 Jupiter fee account
pnpm dev                     # http://localhost:3000
```

## 仓库关系

- **ocufi-web**(本仓,public)— 前端
- **ocufi-api**(private)— 后端(积分 / 提醒 / 邮件),不开源以防被撸毛

## 路线图

V1 两周发布 · V2 扩展英文 / 多链 / TG Bot · 见产品策划书(内部文档)

## 里程碑

- 🎉 **首笔链上买入** · 2026-04-24
  [`54yNodhmd9gJ15AaS2h6W1QTaVGrEHoDbDqmFMbRuoVWHZ63WFBdfys6HmPvwBtndUQKv8VU5KAmxvEmGRuxuuEo`](https://solscan.io/tx/54yNodhmd9gJ15AaS2h6W1QTaVGrEHoDbDqmFMbRuoVWHZ63WFBdfys6HmPvwBtndUQKv8VU5KAmxvEmGRuxuuEo)

## License

MIT(V1 发布时正式公开;目前 private 开发中)
