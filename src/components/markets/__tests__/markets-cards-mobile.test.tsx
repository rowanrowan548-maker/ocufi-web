import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MarketsCardsMobile } from '@/components/markets/markets-cards-mobile';
import type { MarketItem } from '@/lib/api-client';

/**
 * T-FE-MOBILE-RESCUE-P0 · 防回归
 *
 * 防"无意把 md:hidden 双轨改回纯表格"导致 Sprint 3+ 移动端再炸:
 *   - 卡片 wrapper 必须带 md:hidden(< md viewport 显示)
 *   - 每张卡的 ⚡ 快买按钮触控热区 ≥ 44px(min-h-11 是 44px · iOS HIG)
 *   - SmartMoney + Risk badge 在卡顶角(不在数字行)
 *
 * jsdom 不做布局 · 这里测 DOM 结构 + Tailwind class 字面 · 而非真渲染
 */

// MarketsCardsMobile 内部 SmartMoneyBadge 用 IntersectionObserver + fetch · jsdom 不实现 IO
// → mock SmartMoneyBadge 为简单 stub · 让卡片本身可测
vi.mock('@/components/markets/smart-money-badge', () => ({
  SmartMoneyBadge: ({ mint }: { mint: string }) => (
    <span data-testid="smart-money-stub" data-mint={mint}>SM</span>
  ),
}));

const SAMPLE: MarketItem[] = [
  {
    mint: 'TokenA',
    symbol: 'AAA',
    name: 'Token A Long Name',
    logo: null,
    priceUsd: 0.001234,
    change5m: 1.2,
    change1h: -3.4,
    change24h: 5.6,
    liquidityUsd: 12_345_678,
    marketCapUsd: 9_876_543_210,
    volumeH24: 234_567,
    holdersCount: 100,
    ageHours: 48,
    createdAt: 0,
  } as MarketItem,
  {
    mint: 'TokenB',
    symbol: 'BBB',
    name: 'BBB',
    logo: null,
    priceUsd: 0.5,
    change5m: null,
    change1h: 0,
    change24h: -10,
    liquidityUsd: 1_000,
    marketCapUsd: null,
    volumeH24: null,
    holdersCount: 5,
    ageHours: null,
    createdAt: 0,
  } as MarketItem,
];

describe('MarketsCardsMobile · 防回归', () => {
  it('wrapper 带 md:hidden class · 桌面看不到这个轨道', () => {
    const { container } = render(<MarketsCardsMobile items={SAMPLE} />);
    const wrap = container.querySelector('[data-testid="markets-cards-mobile"]');
    expect(wrap).not.toBeNull();
    expect(wrap?.className).toMatch(/\bmd:hidden\b/);
  });

  it('每条 item 渲染一张卡片 · data-mint 对得上', () => {
    const { container } = render(<MarketsCardsMobile items={SAMPLE} />);
    const cards = container.querySelectorAll('[data-testid="markets-card-mobile"]');
    expect(cards.length).toBe(2);
    expect(cards[0].getAttribute('data-mint')).toBe('TokenA');
    expect(cards[1].getAttribute('data-mint')).toBe('TokenB');
  });

  it('每张卡有 ⚡ 快买按钮 · 触控热区 ≥ 44px(h-11 = 44px · iOS HIG)', () => {
    const { container } = render(<MarketsCardsMobile items={SAMPLE} />);
    const buttons = container.querySelectorAll('[data-testid="markets-card-quickbuy"]');
    expect(buttons.length).toBe(2);
    for (const btn of Array.from(buttons)) {
      expect(btn.className).toMatch(/\bh-11\b/);
      expect(btn.className).toMatch(/\bw-full\b/);
    }
  });

  it('快买按钮跳 /trade?mint=X', () => {
    const { container } = render(<MarketsCardsMobile items={SAMPLE} />);
    const links = container.querySelectorAll('[data-testid="markets-card-quickbuy"]');
    expect((links[0] as HTMLAnchorElement).getAttribute('href')).toBe('/trade?mint=TokenA');
    expect((links[1] as HTMLAnchorElement).getAttribute('href')).toBe('/trade?mint=TokenB');
  });

  it('SmartMoneyBadge 在每张卡上(顶角 · 不挤在数字行)', () => {
    const { container } = render(<MarketsCardsMobile items={SAMPLE} />);
    const stubs = container.querySelectorAll('[data-testid="smart-money-stub"]');
    expect(stubs.length).toBe(2);
  });

  it('showRisk + RiskBadge 传入 → 每张卡渲染风险图标', () => {
    const RiskStub = ({ mint }: { mint: string }) => (
      <span data-testid="risk-stub" data-mint={mint}>R</span>
    );
    const { container } = render(
      <MarketsCardsMobile items={SAMPLE} showRisk RiskBadge={RiskStub} />
    );
    const risks = container.querySelectorAll('[data-testid="risk-stub"]');
    expect(risks.length).toBe(2);
  });

  it('showRisk=false → 不渲染风险图标', () => {
    const RiskStub = ({ mint }: { mint: string }) => (
      <span data-testid="risk-stub" data-mint={mint}>R</span>
    );
    const { container } = render(
      <MarketsCardsMobile items={SAMPLE} showRisk={false} RiskBadge={RiskStub} />
    );
    const risks = container.querySelectorAll('[data-testid="risk-stub"]');
    expect(risks.length).toBe(0);
  });

  it('priceUsd null → "—"(不爆)', () => {
    const items: MarketItem[] = [{ ...SAMPLE[0], priceUsd: null }];
    const { container } = render(<MarketsCardsMobile items={items} />);
    const card = container.querySelector('[data-testid="markets-card-mobile"]');
    expect(card?.textContent).toContain('—');
  });
});
