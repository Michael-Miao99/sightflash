import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoot } from './App';

describe('StatsScreen 模式筛选（§27.6）', () => {
  it('数据页出现模式筛选分段：全部 / 认音 / 跟弹，缺省「全部」选中', async () => {
    const u = userEvent.setup();
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /数据/ }));
    expect(await screen.findByText(/速度趋势/)).toBeInTheDocument();
    expect(screen.getByTestId('mode-all')).toHaveTextContent('全部 ✓');
    expect(screen.getByTestId('mode-tap')).toHaveTextContent('认音');
    expect(screen.getByTestId('mode-play')).toHaveTextContent('跟弹');
  });

  it('切到「跟弹」后记录数归零提示仍在（空态文案），常错音符卡标题照常', async () => {
    const u = userEvent.setup();
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /数据/ }));
    await screen.findByText(/速度趋势/);
    await u.click(screen.getByTestId('mode-play'));
    expect(screen.getByTestId('mode-play')).toHaveTextContent('跟弹 ✓');
    expect(screen.getByText(/先完成一轮训练再来看曲线吧/)).toBeInTheDocument();
  });

  afterEach(cleanup);
});
