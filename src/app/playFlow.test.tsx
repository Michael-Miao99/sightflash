import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoot } from './App';

// jsdom 无 getUserMedia/AudioContext → UI 测试 mock micSource（浏览器胶水走真机验收 §27.8）。
// hoisted 假件：状态 + 订阅通知 + handler 注入，可脚本化"授权/来音/拒权"。
const mic = vi.hoisted(() => {
  let status: string = 'idle';
  const subs = new Set<() => void>();
  let handler: { onOnset(e: { midi: number; cents: number }): void; onLevel(l: number, m: number | null): void } | null = null;
  return {
    _set(s: string) { status = s; subs.forEach((l) => l()); },
    _pushLevel(l: number, m: number | null) { handler?.onLevel(l, m); },
    micGetStatus: () => status,
    micSubscribe: (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; },
    micSetHandlers: (h: typeof handler) => { handler = h; },
    micRequest: vi.fn(async () => status),
    micStop: vi.fn(),
  };
});
vi.mock('../ui/micSource', () => ({
  micGetStatus: mic.micGetStatus,
  micSubscribe: mic.micSubscribe,
  micSetHandlers: mic.micSetHandlers,
  micRequest: mic.micRequest,
  micStop: mic.micStop,
}));

/** 从首页走到 setup 并选「跟弹」+ 高音谱（stage1 解锁）→ 应落在校准页 */
async function goCalibrate() {
  const u = userEvent.setup();
  render(<AppRoot repoKind="memory" />);
  await screen.findByText(/五线速读/);
  await u.click(screen.getByRole('button', { name: /开始训练/ }));
  await screen.findByText(/选择模式/);
  await u.click(screen.getByTestId('mode-play'));
  await u.click(screen.getByRole('button', { name: /高音谱/ }));
  await screen.findByText(/麦克风校准/);
  return u;
}

describe('校准页路由与授权（§27.4，mock micSource）', () => {
  it('Setup 有模式分段：默认认音选中；切跟弹后路由到校准页', async () => {
    const u = userEvent.setup();
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择模式/);
    expect(screen.getByTestId('mode-tap')).toHaveTextContent('认音 ✓');
    expect(screen.getByTestId('mode-play')).not.toHaveTextContent('✓');
    await u.click(screen.getByTestId('mode-play'));
    expect(screen.getByTestId('mode-play')).toHaveTextContent('跟弹 ✓');
    await u.click(screen.getByRole('button', { name: /高音谱/ }));
    // play → 先过校准页（非直接进 practice）
    expect(await screen.findByText(/麦克风校准/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /请求麦克风/ })).toBeInTheDocument();
  });

  it('认音模式下选谱号仍直进 practice（tap 路由不变）', async () => {
    const u = userEvent.setup();
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择模式/);
    await u.click(screen.getByRole('button', { name: /高音谱/ })); // 默认认音
    expect(await screen.findByTestId('staff')).toBeInTheDocument();
  });

  it('授权后（running）显示实时听音与开始按钮；弹低音 G2 实时音名出现', async () => {
    await goCalibrate();
    expect(screen.getByRole('button', { name: /请求麦克风/ })).toBeInTheDocument(); // idle 只给请求钮
    // 脚本化"授权通过"：mock 状态变 running → 订阅推送 UI 切到实时听音
    mic._set('running');
    expect(await screen.findByText(/现在听到：-/)).toBeInTheDocument(); // 未弹音：-
    expect(screen.getByRole('button', { name: /开始 \d+s 练习/ })).toBeInTheDocument();
    mic._pushLevel(0.6, 43); // 弹一个低音 G2
    expect(await screen.findByText(/现在听到：G2 ✓/)).toBeInTheDocument();
  });

  it('拒权（denied）显示引导文案，可返回 setup 换认音', async () => {
    await goCalibrate();
    mic._set('denied');
    expect(await screen.findByText(/麦克风不可用/)).toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /返回/ }));
    expect(await screen.findByText(/选择模式/)).toBeInTheDocument();
    expect(screen.getByTestId('mode-play')).toHaveTextContent('跟弹 ✓'); // lastMode 已持久
  });

  afterEach(() => {
    cleanup();
    mic._set('idle');
    mic.micStop.mockClear();
    mic.micRequest.mockClear();
  });
});
