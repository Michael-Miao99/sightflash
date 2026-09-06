import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { cleanup, screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
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
    micStop: vi.fn(() => { status = 'idle'; subs.forEach((l) => l()); }), // 模拟真 stop：置 idle + 通知订阅
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

describe('练习屏 play 版式与逃生（§27.5，mock micSource）', () => {
  it('校准页点「开始」进入 play 练习：作答面板(音名板/仿真琴键)隐藏、实时听音指示器在位', async () => {
    const u = userEvent.setup();
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择模式/);
    await u.click(screen.getByTestId('mode-play'));
    await u.click(screen.getByRole('button', { name: /高音谱/ }));
    await screen.findByText(/麦克风校准/);
    mic._set('running'); // 授权通过
    await screen.findByText(/现在听到：-/);
    await u.click(screen.getByRole('button', { name: /开始 \d+s 练习/ }));
    expect(await screen.findByTestId('staff')).toBeInTheDocument();
    // play 作答面 = 麦克风：无 .note-btn / 无可点 .piano（仿真琴键隐藏）
    expect(document.querySelectorAll('.note-btn')).toHaveLength(0);
    expect(document.querySelector('.practice > .piano')).toBeNull();
    // 实时听音指示器在位（音量条 + 音名）
    expect(screen.getByTestId('mic-hud')).toBeInTheDocument();
    expect(screen.getByTestId('live-name')).toHaveTextContent('现在听到：-');
    // 初始待听引导
    expect(screen.getByTestId('feedback')).toHaveTextContent(/对着麦克风/);
    // 新题未判 → 逃生行不出现（[键位提示]/[下一题] 平时不占屏）
    expect(screen.queryByTestId('escape-row')).toBeNull();
  });

  it('实时来音反映到指示器（模拟弹一个音）', async () => {
    await goPlay(() => {});
    mic._pushLevel(0.5, 60); // C4
    expect(await screen.findByTestId('live-name')).toHaveTextContent('现在听到：C4');
  });

  afterEach(() => {
    mic._set('idle');
    mic.micStop.mockClear();
    mic.micRequest.mockClear();
  });
});

describe('StrictMode 下校准沿用流不被误杀（§27.3 回归）', () => {
  it('dev 双挂载后仍留在练习屏正常倒计时，不会直接跳到本轮完成', async () => {
    // React dev StrictMode 首挂会模拟一次"卸载→重挂"。若练习屏卸载兜底调 mic.stop()，
    // 会把校准沿用进来的 running 流杀掉 → 流中断分支 setLeft(0) → 直接结算（真机 dev 复现）。
    const u = userEvent.setup();
    render(
      <StrictMode>
        <AppRoot repoKind="memory" />
      </StrictMode>,
    );
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择模式/);
    await u.click(screen.getByTestId('mode-play'));
    await u.click(screen.getByRole('button', { name: /高音谱/ }));
    await screen.findByText(/麦克风校准/);
    mic._set('running'); // 授权通过（校准页已 running）
    await screen.findByText(/现在听到：-/);
    // 双挂载发生在"开始练习"后的重渲染期间；跑完效应微任务队列，确认没提前结算
    await u.click(screen.getByRole('button', { name: /开始 \d+s 练习/ }));
    // 仍在练习屏：实时听音指示器在位、倒计时 ≥60、无"本轮完成"
    expect(await screen.findByTestId('mic-hud')).toBeInTheDocument();
    expect(screen.getByTestId('feedback')).toHaveTextContent(/对着麦克风/);
    expect(screen.queryByText('本轮完成')).toBeNull();
    // 流未被误杀：mic.stop 不应被练习屏挂载路径调用（结算/离屏才 stop）
    expect(mic.micStop).not.toHaveBeenCalled();
  });

  afterEach(() => {
    cleanup();
    mic._set('idle');
    mic.micStop.mockClear();
    mic.micRequest.mockClear();
  });
});

/** 进入 play 练习屏：home → 开始 → 跟弹 → 高音谱 → 授权 → 开始练习 */
async function goPlay(onReady: () => void): Promise<UserEvent> {
  const u = userEvent.setup();
  render(<AppRoot repoKind="memory" />);
  await screen.findByText(/五线速读/);
  await u.click(screen.getByRole('button', { name: /开始训练/ }));
  await screen.findByText(/选择模式/);
  await u.click(screen.getByTestId('mode-play'));
  await u.click(screen.getByRole('button', { name: /高音谱/ }));
  await screen.findByText(/麦克风校准/);
  mic._set('running');
  await screen.findByText(/现在听到：-/);
  await u.click(screen.getByRole('button', { name: /开始 \d+s 练习/ }));
  await screen.findByTestId('staff');
  onReady();
  return u;
}
