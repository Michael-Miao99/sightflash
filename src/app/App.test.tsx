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
    expect(await screen.findByText(/开始设置/)).toBeInTheDocument();
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
