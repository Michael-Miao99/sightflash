import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { AppRoot } from './App';
import { LETTER_PC } from '../core/notation/note';

// jsdom 无 getUserMedia/AudioContext → UI 测试 mock micSource（浏览器胶水走真机验收 §27.8）。
// hoisted 假件：状态 + 订阅通知 + handler 注入，可脚本化"授权/来音/拒权/中断"。
const mic = vi.hoisted(() => {
  let status: string = 'idle';
  const subs = new Set<() => void>();
  let handler: { onOnset(e: { midi: number; cents: number }): void; onLevel(l: number, m: number | null): void } | null = null;
  return {
    _set(s: string) { status = s; subs.forEach((l) => l()); },
    _pushLevel(l: number, m: number | null) { handler?.onLevel(l, m); },
    _pushOnset(midi: number, cents: number) { handler?.onOnset({ midi, cents }); },
    micGetStatus: () => status,
    micSubscribe: (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; },
    micSetHandlers: (h: typeof handler) => { handler = h; },
    // 真行为近似：非终态 → 先置 requesting（授权弹窗）再由测试 _set 到 running/denied/…
    micRequest: vi.fn(async () => {
      if (!['running', 'requesting'].includes(status)) status = 'requesting';
      subs.forEach((l) => l());
      return status;
    }),
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

/** 从首页走到练习屏（选谱号直进，§28：无模式分段/校准页） */
async function goPractice(): Promise<UserEvent> {
  const u = userEvent.setup();
  render(<AppRoot repoKind="memory" />);
  await screen.findByText(/五线速读/);
  await u.click(screen.getByRole('button', { name: /开始训练/ }));
  await screen.findByText(/选择谱号/);
  await u.click(screen.getByRole('button', { name: /高音谱/ }));
  await screen.findByTestId('staff');
  return u;
}

/** 进入练习并把"跟弹"开关打开（授权 running） */
async function goPracticePlay(): Promise<UserEvent> {
  const u = await goPractice();
  const toggle = screen.getByTestId('mic-toggle');
  await u.click(toggle);
  await act(async () => { mic._set('running'); });
  return u;
}

const toggleChecked = () =>
  (screen.getByRole('checkbox', { name: /跟弹/ }) as HTMLInputElement).checked;

/** 从 feedback 的"✗ 是 Xn"揭晓串里取目标音名（自然音：字母+八度，如 "E4"） */
function revealName(): string {
  const t = screen.getByTestId('feedback').textContent ?? '';
  const m = t.match(/✗ 是 ([A-G])(\d+)/);
  if (!m) throw new Error(`feedback 未揭晓音名: "${t}"`);
  return `${m[1]}${m[2]}`;
}

/** 自然音名 → MIDI（同中音 C4=60 规约：midi = (octave+1)*12 + pc） */
function naturalNameToMidi(name: string): number {
  const m = name.match(/^([A-G])(\d+)$/);
  if (!m) throw new Error(`无法解析音名: "${name}"`);
  return (Number(m[2]) + 1) * 12 + LETTER_PC[m[1]];
}

describe('Setup 统一入口与认音默认界面（§28）', () => {
  it('无模式分段/校准页：选谱号直进练习，练习屏保持认音元素、无实时听音读数', async () => {
    const u = userEvent.setup();
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择谱号/);
    // 不再有"选择模式"分段与跟弹预选
    expect(screen.queryByText(/选择模式/)).toBeNull();
    expect(screen.queryByTestId('mode-play')).toBeNull();
    await u.click(screen.getByRole('button', { name: /高音谱/ }));
    await screen.findByTestId('staff');
    // 认音作答面全在：音名板 7 键 + 仿真琴键 + 反馈
    expect(document.querySelectorAll('.note-btn')).toHaveLength(7);
    expect(document.querySelector('.practice > .piano')).not.toBeNull();
    expect(screen.getByTestId('feedback')).toBeInTheDocument();
    // 无实时听音读数（mic-hud / 现在听到 / 音量）——跟弹读数只在界面上不留
    expect(screen.queryByTestId('mic-hud')).toBeNull();
    expect(screen.queryByText(/现在听到/)).toBeNull();
    // 屏内跟弹开关在位、默认关
    expect(screen.getByTestId('mic-toggle')).toHaveTextContent('跟弹');
    expect(toggleChecked()).toBe(false);
  });

  it('跟弹界面与认音无差别：开启监听时音名板/琴键仍在、不显示实时听音', async () => {
    await goPracticePlay();
    // 开启后作答面板保持（无差别）；麦克风不显示"现在听到/音量"
    expect(document.querySelectorAll('.note-btn').length).toBeGreaterThan(0);
    expect(document.querySelector('.practice > .piano')).not.toBeNull();
    expect(screen.queryByTestId('mic-hud')).toBeNull();
    expect(screen.queryByText(/现在听到/)).toBeNull();
    expect(toggleChecked()).toBe(true);
  });

  afterEach(() => {
    cleanup();
    mic._set('idle');
    mic.micStop.mockClear();
    mic.micRequest.mockClear();
  });
});

describe('跟弹开关：授权 / 拒权 / 中断（§28，mock micSource）', () => {
  it('开启开关即请求授权；授权通过后保持开启', async () => {
    const u = await goPractice();
    await u.click(screen.getByTestId('mic-toggle'));
    expect(mic.micRequest).toHaveBeenCalledTimes(1);
    expect(toggleChecked()).toBe(true); // 请求中保持开
    await act(async () => { mic._set('running'); });
    expect(toggleChecked()).toBe(true);
  });

  it('拒权 → 自动回关并提示；认音作答不受打断', async () => {
    const u = await goPractice();
    await u.click(screen.getByTestId('mic-toggle'));
    await act(async () => { mic._set('denied'); });
    expect(toggleChecked()).toBe(false);
    expect(screen.getByTestId('mic-msg')).toHaveTextContent(/被拒/);
    // 点一个音名钮：认音照常判（对/错都会有反馈，不再是对着麦克风引导）
    await u.click(document.querySelectorAll('.note-btn')[0]!);
    expect(screen.getByTestId('feedback').textContent).toMatch(/✓|✗/);
    expect(screen.queryByText('本轮完成')).toBeNull(); // 不提前结算
  });

  it('麦克风中断（running→idle）→ 自动回关提示，本轮不提前结算，仍可认音', async () => {
    const u = await goPracticePlay();
    // 运行中被中断（后台/权限撤）→ 关回跟弹，不 setLeft(0) 提前结算
    await act(async () => { mic._set('idle'); });
    expect(toggleChecked()).toBe(false);
    expect(screen.getByTestId('mic-msg')).toHaveTextContent(/中断/);
    expect(screen.queryByText('本轮完成')).toBeNull(); // 仍在倒计时练习
    expect(screen.getByTestId('staff')).toBeInTheDocument();
    await u.click(document.querySelectorAll('.note-btn')[0]!);
    expect(screen.getByTestId('feedback').textContent).toMatch(/✓|✗/);
  });

  it('关闭开关即停麦（stop 被调用、开关复位）', async () => {
    const u = await goPracticePlay();
    expect(mic.micStop).not.toHaveBeenCalled();
    await u.click(screen.getByTestId('mic-toggle')); // 关
    expect(mic.micStop).toHaveBeenCalled();
    expect(toggleChecked()).toBe(false);
    expect(screen.queryByTestId('mic-msg')).toBeNull();
  });

  afterEach(() => {
    cleanup();
    mic._set('idle');
    mic.micStop.mockClear();
    mic.micRequest.mockClear();
  });
});

describe('统一首击判分与判对消隐（§28，可注入起音）', () => {
  it('首击弹错（远音 21）→ 判错停留、出逃生行，反馈揭晓目标音名', async () => {
    await goPracticePlay();
    await act(async () => { mic._pushOnset(21, 0); });
    expect(screen.getByTestId('feedback').textContent).toMatch(/✗ 是 [A-G]\d/);
    expect(screen.getByTestId('escape-row')).toBeInTheDocument();
  });

  it('逃生 [下一题] 后紧跟的旧音起音被消隐窗吞，不误判新题（§27 补回归保留）', async () => {
    await goPracticePlay();
    await act(async () => { mic._pushOnset(21, 0); }); // 首击错 → 停留、逃生行出现
    expect(screen.getByTestId('escape-row')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId('escape-skip')); // 逃生换题 → 起消隐窗
    // 紧跟"旧音余音"起音：被吞则保持待答引导、逃生行不重现（包 act 让 React flush，防读到旧 DOM）
    await act(async () => { mic._pushOnset(21, 0); });
    expect(screen.getByTestId('feedback').textContent).toMatch(/弹出或用音名点出/);
    expect(screen.queryByTestId('escape-row')).toBeNull();
  });

  it('判对 → 绿✓；紧随其后的旧音同键起音被停留窗吞，不误判（§28 核心回归）', async () => {
    await goPracticePlay();
    await act(async () => { mic._pushOnset(21, 0); }); // 首击错 → 揭晓目标
    const t1 = naturalNameToMidi(revealName());
    // 弹对 + 立刻再补一次同键（旧音余音/重音头）：判对起停留窗，第二击被吞、不误判
    await act(async () => { mic._pushOnset(t1, 0); mic._pushOnset(t1, 0); });
    expect(screen.getByTestId('feedback').textContent).toContain('✓ 对！');
    expect(screen.queryByTestId('escape-row')).toBeNull(); // 未被误判成错
    // 等停留窗走完（推进换题），把定时 setSess 包在 act 内，避免漏清理告警
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  });

  it('屏上点按亦统一首击：首击点错 → 停留逃生；按揭晓音名点对 → ✓（试错不重计、推进）', async () => {
    const u = await goPracticePlay();
    await act(async () => { mic._pushOnset(21, 0); }); // 起音首击错 → 揭晓目标音名
    const name = revealName();
    expect(screen.getByTestId('escape-row')).toBeInTheDocument();
    // 用音名板点对（试错到对）→ ✓；逃生行消失；仍留在练习（未误判、已推进）
    await u.click(screen.getByRole('button', { name: name[0] }));
    expect(screen.getByTestId('feedback').textContent).toContain('✓ 对！');
    expect(screen.queryByTestId('escape-row')).toBeNull();
    // 等停留窗走完（推进换题），把定时 setSess 包在 act 内
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  });

  afterEach(() => {
    cleanup();
    mic._set('idle');
    mic.micStop.mockClear();
    mic.micRequest.mockClear();
  });
});

describe('跟弹开关默认沿用上次状态（settings.followPlay，§28 老板追加）', () => {
  /** seed followPlay=true 直进练习屏 */
  async function goPracticeFollowOn(): Promise<UserEvent> {
    const u = userEvent.setup();
    render(<AppRoot repoKind="memory" seed={{ followPlay: true }} />);
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择谱号/);
    await u.click(screen.getByRole('button', { name: /高音谱/ }));
    await screen.findByTestId('staff');
    return u;
  }

  it('上次开过跟弹 → 进屏开关默认开、自动请求授权、授权后保持开（界面无差别）', async () => {
    await goPracticeFollowOn();
    expect(toggleChecked()).toBe(true); // 默认沿用上次的开
    expect(mic.micRequest).toHaveBeenCalled(); // 开机即自动请求（无需再点开关）
    await act(async () => { mic._set('running'); });
    expect(toggleChecked()).toBe(true);
    expect(screen.getByTestId('feedback')).toBeInTheDocument(); // 作答面全在
    expect(document.querySelector('.practice > .piano')).not.toBeNull();
  });

  it('上次开过但授权被拒 → 自动回关并提示，本轮认音不打断、不提前结算', async () => {
    const u = await goPracticeFollowOn();
    await act(async () => { mic._set('denied'); });
    expect(toggleChecked()).toBe(false);
    expect(screen.getByTestId('mic-msg')).toHaveTextContent(/被拒/);
    expect(screen.queryByText('本轮完成')).toBeNull();
    await u.click(document.querySelectorAll('.note-btn')[0]!);
    expect(screen.getByTestId('feedback').textContent).toMatch(/✓|✗/); // 认音照常
  });

  it('默认关（seed 缺省）：上次未开 → 进屏开关关、不自动请求授权', async () => {
    await goPractice();
    expect(toggleChecked()).toBe(false);
    expect(mic.micRequest).not.toHaveBeenCalled();
  });

  afterEach(() => {
    cleanup();
    mic._set('idle');
    mic.micStop.mockClear();
    mic.micRequest.mockClear();
  });
});

describe('StrictMode 开发态不误杀（§28）', () => {
  it('双挂载后仍在练习屏正常倒计时，不直接跳本轮完成', async () => {
    const u = userEvent.setup();
    render(
      <StrictMode>
        <AppRoot repoKind="memory" />
      </StrictMode>,
    );
    await screen.findByText(/五线速读/);
    await u.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择谱号/);
    await u.click(screen.getByRole('button', { name: /高音谱/ }));
    await screen.findByTestId('staff');
    // 开跟弹并授权：仍留在练习屏（卸载清理停麦发生在双挂载时、彼时未开麦，幂等无害）
    await u.click(screen.getByTestId('mic-toggle'));
    await act(async () => { mic._set('running'); });
    expect(toggleChecked()).toBe(true);
    expect(screen.getByTestId('feedback')).toBeInTheDocument();
    expect(screen.queryByText('本轮完成')).toBeNull();
  });

  afterEach(() => {
    cleanup();
    mic._set('idle');
    mic.micStop.mockClear();
    mic.micRequest.mockClear();
  });
});
