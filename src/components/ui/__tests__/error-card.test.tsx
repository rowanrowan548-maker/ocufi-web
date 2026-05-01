import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ErrorCard } from '@/components/ui/error-card';

/**
 * T-FE-STABILITY-ERROR-BOUNDARIES · ErrorCard 防回归
 */

describe('ErrorCard · 渲染 + 交互', () => {
  it('渲染 title + AlertCircle 图标', () => {
    const { container, getByText } = render(<ErrorCard title="行情加载失败" />);
    expect(getByText('行情加载失败')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="error-card"]')).not.toBeNull();
  });

  it('有 message → 显示 · 没 message → 不渲染', () => {
    const { getByText, rerender, queryByText } = render(
      <ErrorCard title="X" message="可能是 GeckoTerminal 临时波动" />
    );
    expect(getByText('可能是 GeckoTerminal 临时波动')).toBeInTheDocument();

    rerender(<ErrorCard title="X" />);
    expect(queryByText('可能是 GeckoTerminal 临时波动')).toBeNull();
  });

  it('有 onRetry → 显示重试按钮 · 点击触发 onRetry', () => {
    const onRetry = vi.fn();
    const { container } = render(<ErrorCard title="X" onRetry={onRetry} />);
    const btn = container.querySelector('[data-testid="error-card-retry"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('没 onRetry → 不渲染重试按钮', () => {
    const { container } = render(<ErrorCard title="X" />);
    expect(container.querySelector('[data-testid="error-card-retry"]')).toBeNull();
  });

  it('detail 折在 <details> 里 · 不默认展开', () => {
    const { container, getByText } = render(
      <ErrorCard title="X" detail="ApiError 500 /admin/stats: oops" />
    );
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(getByText('详情')).toBeInTheDocument();
  });

  it('自定义 testId 生效 · retry 也跟着前缀', () => {
    const onRetry = vi.fn();
    const { container } = render(
      <ErrorCard title="X" testId="markets-err" onRetry={onRetry} />
    );
    expect(container.querySelector('[data-testid="markets-err"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="markets-err-retry"]')).not.toBeNull();
  });
});
