import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoot } from './App';

describe('AppRoot', () => {
  it('加载后首页出现“五线速读”', async () => {
    render(<AppRoot repoKind="memory" />);
    expect(await screen.findByText(/五线速读/)).toBeInTheDocument();
  });

  it('点“开始训练”进入 setup 视图', async () => {
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await userEvent.click(screen.getByRole('button', { name: /开始训练/ }));
    expect(await screen.findByText(/选择谱号/)).toBeInTheDocument();
  });

  it('setup 选高音谱进入练习（认音关键路径）', async () => {
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await userEvent.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择谱号/);
    // S1 下 bass/mixed 应锁定
    expect(screen.getByRole('button', { name: /低音谱/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /高音谱/ }));
    expect(await screen.findByTestId('staff')).toBeInTheDocument();
  });

  it('数据页可打开（空态文案）', async () => {
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await userEvent.click(screen.getByRole('button', { name: /数据/ }));
    expect(await screen.findByText(/练习数据/)).toBeInTheDocument();
    expect(screen.getByText(/先完成一轮训练再来看曲线吧/)).toBeInTheDocument();
  });

  it('设置页可打开', async () => {
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await userEvent.click(screen.getByRole('button', { name: /设置/ }));
    expect(await screen.findByText(/清除本地数据/)).toBeInTheDocument();
  });

  it('默认 natural：进入练习后音名板保持 7 键（与现状一致）', async () => {
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await userEvent.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择谱号/);
    await userEvent.click(screen.getByRole('button', { name: /高音谱/ }));
    await screen.findByTestId('staff');
    expect(document.querySelectorAll('.note-btn')).toHaveLength(7);
    expect(document.querySelectorAll('.note-btn.black-name')).toHaveLength(0);
  });

  it('设置开练黑键后：同一载入内回首页再进练习，音名板 12 键含 5 个双名黑键键', async () => {
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await userEvent.click(screen.getByRole('button', { name: /设置/ }));
    await screen.findByText(/清除本地数据/);
    const toggle = screen.getByTestId('gamut-toggle');
    expect(toggle).toHaveTextContent('关');
    await userEvent.click(toggle);
    expect(screen.getByTestId('gamut-toggle')).toHaveTextContent('开');
    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    await userEvent.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择谱号/);
    await userEvent.click(screen.getByRole('button', { name: /高音谱/ }));
    await screen.findByTestId('staff');
    expect(document.querySelectorAll('.note-btn')).toHaveLength(12);
    expect(document.querySelectorAll('.note-btn.black-name')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'C#/Db' })).toBeInTheDocument();
  });

  it('IndexedDB 打开失败时内存降级，不卡在载入中', async () => {
    // 模拟真实环境：indexedDB 存在但不可用（隐私模式/存储禁用）→ IdbRepo.openDB 失败
    vi.stubGlobal('indexedDB', {});
    render(<AppRoot repoKind="auto" />);
    expect(await screen.findByText(/五线速读/)).toBeInTheDocument();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
});
