# SightFlash 琴键作答 + 钢琴音色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 认音模式下新增**仿真钢琴键盘作答**（精确到八度）+ 把单音"叮"提示音替换为**匹配音高的 WebAudio 合成钢琴音**（答对/答错都听见实际音高）。

**Architecture:** 会话层加纯函数 `answerKey`（与 `answerTap` 同构，按精确 MIDI 判）；UI 加 `Piano` 组件（高音窗 C4–C6 / 低音窗 G2–G4）；发声抽到 `piano.ts`（加法合成、按需缓存 buffer、开关/无 WebAudio 静默）；PracticeScreen 双入口共存，移除旧 `sound.ts`。core 层保持纯 TS 不碰 React。

**Tech Stack:** Vite 8 / React 19 / TS(strict) / vitest(jsdom) / WebAudio（无素材依赖）。

**设计依据：** `sightflash/docs/superpowers/specs/2026-09-05-sightflash-design.md` §20 增补（已批准）。本仓库 tsconfig 为 solution-style：**类型门禁一律用 `npx tsc -b`**（`tsc --noEmit` 检查 0 文件，是空操作）。

---

## 通用约定

- 仓库根：`d:/OneDrive/claude_project/cleaner`；子项目 `sightflash/`。提交只 `git add sightflash/...` 具体文件。
- 基线：56 测试全绿（12 文件）。`answerTap` 按音级判（任意八度对）；谱号/键位窗口范围见 §20。`LETTER_PC`（C=0…B=11）、`midiHz`、`MixedClef`、`Clef` 语义均为既有。
- 现有练习屏 `PracticeScreen.tsx` 已 import `playFeedback from './sound'` 并在 `onTap` 用它发 ok/bad 音——本计划将整体替换该发声逻辑并**删除 `sound.ts` / `sound.test.ts`**。
- 每任务完成跑：`npx vitest run <相关文件>`、`npx tsc -b`（exit 0）。

---

### Task P1: WebAudio 合成钢琴引擎 `piano.ts` + 单测

**Files:**
- Create: `sightflash/src/ui/piano.ts`
- Create: `sightflash/src/ui/piano.test.ts`

- [ ] **Step 1: 写失败测试 `sightflash/src/ui/piano.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { midiHz, playPiano, __resetPianoForTest } from './piano';

function installFakeAudio() {
  const made: Array<{ src: Record<string, unknown>; buf: { data: Float32Array } }> = [];
  class FakeParam {
    value = 0;
    setValueAtTime(): void {}
    exponentialRampToValueAtTime(): void {}
  }
  class FakeGain {
    gain = new FakeParam();
    connect(_d?: unknown) { return this; }
  }
  class FakeContext {
    sampleRate = 48000;
    currentTime = 0;
    state: 'running' | 'suspended' = 'running';
    destination = {};
    createBuffer(_ch: number, length: number, sr: number) {
      const buf = { length, sampleRate: sr, data: new Float32Array(length) };
      Object.defineProperty(buf, 'duration', { value: length / sr });
      const record = { src: {} as Record<string, unknown>, buf: buf as unknown as { data: Float32Array } };
      // 让引擎写入的 buffer 就是记录里的 data
      return record.buf as unknown as AudioBuffer;
    }
    getChannelDataFallback() { return new Float32Array(0); }
    createBufferSource() {
      const src: Record<string, unknown> = {
        buffer: null,
        connect(_d?: unknown) { return this; },
        start() {},
        stop() {},
      };
      // 关联到最近一次 createBuffer 的记录
      made[made.length - 1].src = src;
      return src as unknown as AudioBufferSourceNode;
    }
    createGain() { return new FakeGain() as unknown as GainNode; }
    resume(): Promise<void> { return Promise.resolve(); }
  }
  const AC = vi.fn(function (this: unknown) { return new FakeContext(); }) as unknown as typeof AudioContext;
  vi.stubGlobal('AudioContext', AC);
  return { AC, made };
}

afterEach(() => {
  __resetPianoForTest();
  vi.unstubAllGlobals();
});

describe('piano 引擎', () => {
  it('midiHz：A4(69)=440、C4(60)≈261.63', () => {
    expect(midiHz(69)).toBeCloseTo(440, 6);
    expect(midiHz(60)).toBeCloseTo(261.63, 1);
  });

  it('enabled=false 不创建 AudioContext（静默）', () => {
    const { AC } = installFakeAudio();
    playPiano(false, 60);
    expect(AC).not.toHaveBeenCalled();
  });

  it('enabled=true 生成一段非静音 buffer 并播放一次', () => {
    const { AC, made } = installFakeAudio();
    playPiano(true, 60);
    expect(AC).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(1);
    expect(made[0].src.start).toBeTypeOf('function');
    const data = made[0].buf.data;
    expect(data.some((v) => Math.abs(v) > 1e-4)).toBe(true); // 真的写入了波形
  });

  it('同一音高重复播放命中缓存（不再二次合成）', () => {
    const { made } = installFakeAudio();
    playPiano(true, 60);
    playPiano(true, 60);
    expect(made).toHaveLength(1); // 只 createBuffer 一次
  });

  it('无 WebAudio 环境静默返回不抛错', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playPiano(true, 60)).not.toThrow();
  });
});
```

说明：`made[made.length-1]` 依赖 createBuffer 先于 createBufferSource 调用——引擎实现顺序即如此，测试忠实反映引擎行为；若你改实现顺序，同步调整记录关联即可。

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run src/ui/piano.test.ts
```
Expected: FAIL（`./piano` 不存在）。

- [ ] **Step 3: 实现 `sightflash/src/ui/piano.ts`**

```ts
// WebAudio 加法合成钢琴音。无素材依赖；jsdom / 无 WebAudio / 设置关闭时静默。
interface WebAudioGlobal {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

/** MIDI 号 → 频率(Hz)。A4(69)=440 */
export const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

let ac: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

function getCtx(): AudioContext | null {
  const g = globalThis as unknown as WebAudioGlobal;
  const AC = g.AudioContext ?? g.webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ac) ac = new AC();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

/** 合成一个近似钢琴的单音 buffer：基频 + 泛音、轻微不谐、按音区指数衰减。 */
function buildPianoBuffer(ctx: AudioContext, midi: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const f0 = midiHz(midi);
  const tau1 = 1.5 * (262 / f0) ** 0.45; // 低音衰减慢、高音快
  const dur = Math.min(6, Math.max(1.2, tau1 * 4));
  const n = Math.ceil(dur * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const data = buf.getChannelData(0);
  const partials = 6;
  const inhar = 0.0003; // 不谐性系数：真实钢琴高次泛音略偏高
  let max = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (let p = 1; p <= partials; p++) {
      const f = f0 * p * (1 + inhar * p * p);
      s += (1 / p ** 1.8) * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / (tau1 / Math.sqrt(p)));
    }
    data[i] = s;
    const a = Math.abs(s);
    if (a > max) max = a;
  }
  if (max > 0.95) {
    const k = 0.95 / max;
    for (let i = 0; i < n; i++) data[i] *= k;
  }
  return buf;
}

/** 播放某音高钢琴音；enabled 关或无 WebAudio 时静默。每次按键都是用户手势内调用。 */
export function playPiano(enabled: boolean, midi: number): void {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const key = `${midi}@${ctx.sampleRate}`;
    let buf = bufferCache.get(key);
    if (!buf) {
      buf = buildPianoBuffer(ctx, midi);
      bufferCache.set(key, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + buf.duration);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + buf.duration);
  } catch {
    /* 音频失败静默，不影响训练 */
  }
}

/** 测试专用：清空缓存的 Context 与 buffer。勿在生产调用。 */
export function __resetPianoForTest(): void {
  ac = null;
  bufferCache.clear();
}
```

- [ ] **Step 4: 跑测试确认 PASS**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run src/ui/piano.test.ts
```
Expected: 5 passed。

- [ ] **Step 5: 类型门禁**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx tsc -b # exit 0
```

- [ ] **Step 6: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/ui/piano.ts sightflash/src/ui/piano.test.ts
git commit -m "feat(sightflash): WebAudio 合成钢琴引擎 piano.ts（含单测）"
```

---

### Task P2: 会话层 `answerKey`（精确八度作答）+ 单测

**Files:**
- Modify: `sightflash/src/core/session.ts`（`answerTap` 之后新增 `answerKey` 并导出）
- Modify: `sightflash/src/core/session.test.ts`（追加用例）

- [ ] **Step 1: 写失败测试（追加到 `session.test.ts` 末尾，import 行补 `answerKey`）**

```ts
function makeSession(targetMidi: number): Session {
  return {
    stage: 1,
    clef: 'treble',
    durationSec: 60,
    rng: () => 0.5,
    wrong: {},
    target: { midi: targetMidi, clef: 'treble' },
    correct: 0,
    total: 0,
    history: [],
    last: null,
  };
}

describe('answerKey 精确八度作答', () => {
  it('点到同一 MIDI 判对：计入正确、推进下一题', () => {
    const s = makeSession(60); // C4
    const next = answerKey(s, 60);
    expect(next.last?.result).toBe('correct');
    expect(next.correct).toBe(1);
    expect(next.total).toBe(1);
    expect(next.history[0]).toMatchObject({ expectedMidi: 60, actualPc: 0 });
    expect(next.target).not.toBe(s.target); // 推进到新题
  });

  it('同音名错八度（C5=72）判错：题目停留可重试', () => {
    const s = makeSession(60);
    const next = answerKey(s, 72);
    expect(next.last?.result).toBe('wrong');
    expect(next.correct).toBe(0);
    expect(next.total).toBe(1);
    expect(next.history[0].actualPc).toBe(0);
    expect(next.target).toBe(s.target); // 未推进
  });

  it('点黑键（如 C#4=61）对自然音目标恒判错', () => {
    const s = makeSession(62); // D4 自然音
    const next = answerKey(s, 61); // C#4
    expect(next.last?.result).toBe('wrong');
    expect(next.correct).toBe(0);
    expect(next.history[0].actualPc).toBe(1);
  });
});
```

若 `session.test.ts` 顶部已 `import type { Session }` 则复用；没有则在文件内补 `import type { Session } from './session';`。已有测试风格为 `describe('...')` 平铺，保持同风格即可（不要改已有用例）。

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run src/core/session.test.ts
```
Expected: FAIL（`answerKey` 未导出 / not defined）。

- [ ] **Step 3: 在 `session.ts` 的 `answerTap` 后新增并导出**

```ts
/**
 * 琴键作答（pure）：按精确 MIDI 判定（八度必须一致）。
 * 对则推进下一题；错则题目停留便于重试。与 answerTap 同构，仅判定粒度不同。
 */
export function answerKey(s: Session, midi: number): Session {
  const expectedPc = s.target.midi % 12;
  const ok = midi === s.target.midi;
  const item: HistoryItem = {
    result: ok ? 'correct' : 'wrong',
    expectedMidi: s.target.midi,
    expectedPc,
    actualPc: midi % 12,
  };
  const history = [item, ...s.history];
  const target = ok ? chooseQuestion(s.rng, s.stage, s.clef, s.wrong, s.target.midi) : s.target;
  return { ...s, target, correct: s.correct + (ok ? 1 : 0), total: s.total + 1, history, last: item };
}
```

- [ ] **Step 4: 跑测试确认 PASS + 全量回归**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run src/core/session.test.ts   # 4+3 全绿
npx vitest run                            # 全量（56 基线不变）
npx tsc -b                                # exit 0
```

- [ ] **Step 5: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/core/session.ts sightflash/src/core/session.test.ts
git commit -m "feat(sightflash): 会话 answerKey 精确八度作答（含单测）"
```

---

### Task P3: 仿真钢琴键盘组件 `Piano.tsx` + 组件测试

**Files:**
- Create: `sightflash/src/ui/Piano.tsx`
- Create: `sightflash/src/ui/Piano.test.tsx`
- Modify: `sightflash/src/index.css`（追加键盘样式）

- [ ] **Step 1: 写失败测试 `sightflash/src/ui/Piano.test.tsx`**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Piano } from './Piano';

afterEach(() => {
  cleanup();
});

describe('Piano', () => {
  it('高音窗口 C4~C6：15 白键 + 10 黑键，首尾键号正确', () => {
    const onKey = vi.fn();
    render(<Piano clef="treble" onKey={onKey} />);
    expect(screen.getAllByTestId(/^w-/)).toHaveLength(15);
    expect(screen.getAllByTestId(/^b-/)).toHaveLength(10);
    expect(screen.getByTestId('w-60')).toBeInTheDocument(); // C4
    expect(screen.getByTestId('w-84')).toBeInTheDocument(); // C6
    expect(screen.getByTestId('b-61')).toBeInTheDocument(); // C#4
  });

  it('低音窗口 G2~G4：15 白键 + 10 黑键，边界 G2/G4', () => {
    const onKey = vi.fn();
    render(<Piano clef="bass" onKey={onKey} />);
    expect(screen.getByTestId('w-43')).toBeInTheDocument(); // G2
    expect(screen.getByTestId('w-67')).toBeInTheDocument(); // G4
    expect(screen.getByTestId('b-66')).toBeInTheDocument(); // F#4
  });

  it('按下琴键触发 onKey(对应 midi)', () => {
    const onKey = vi.fn();
    render(<Piano clef="treble" onKey={onKey} />);
    fireEvent.pointerDown(screen.getByTestId('w-62')); // D4
    expect(onKey).toHaveBeenCalledWith(62);
    fireEvent.pointerDown(screen.getByTestId('b-63')); // D#4
    expect(onKey).toHaveBeenCalledWith(63);
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run src/ui/Piano.test.tsx
```
Expected: FAIL（`./Piano` 不存在）。

- [ ] **Step 3: 实现 `sightflash/src/ui/Piano.tsx`**

```tsx
import { useMemo } from 'react';
import type { Clef } from '../core/notation/positions';

const BLACK_PC = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A#
/** 琴键窗口（含两端）：高音 C4~C6、低音 G2~G4。端点均为自然音白键，覆盖全部目标。 */
const RANGE: Record<Clef, [number, number]> = { treble: [60, 84], bass: [43, 67] };
const BLACK_W = 0.62; // 黑键宽 = 白键宽的 0.62

function naturals(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (!BLACK_PC.has(m % 12)) out.push(m);
  return out;
}
function blacks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (BLACK_PC.has(m % 12)) out.push(m);
  return out;
}

/** 仿真钢琴键盘：点击琴键（白/黑）回调 onKey(midi)。画出来由调用方决定发声与判定。 */
export function Piano({ clef, onKey }: { clef: Clef; onKey: (midi: number) => void }) {
  const [lo, hi] = RANGE[clef];
  const whites = useMemo(() => naturals(lo, hi), [lo, hi]);
  const blackList = useMemo(() => blacks(lo, hi), [lo, hi]);
  const whiteIdx = useMemo(() => new Map(whites.map((m, i) => [m, i])), [whites]);
  return (
    <div className="piano" role="group" aria-label="钢琴键盘">
      {whites.map((m) => (
        <div key={m} data-testid={`w-${m}`} data-midi={m} className="key white"
          onPointerDown={(e) => { e.preventDefault(); onKey(m); }} />
      ))}
      {blackList.map((m) => {
        const i = whiteIdx.get(m - 1) ?? 0; // 黑键左侧白键下标
        const left = ((i + 1 - BLACK_W / 2) / whites.length) * 100;
        const width = (BLACK_W / whites.length) * 100;
        return (
          <div key={m} data-testid={`b-${m}`} data-midi={m} className="key black"
            style={{ left: `${left}%`, width: `${width}%` }}
            onPointerDown={(e) => { e.preventDefault(); onKey(m); }} />
        );
      })}
    </div>
  );
}
```

`Clef` 来自 `positions.ts`（`'treble' | 'bass'`，StaffView 用的同类型），确认该导出存在再用；若 `Clef` 不含导出则 `import type { Clef } from '../core/notation/positions';` 按文件实际导出调整。

- [ ] **Step 4: 追加 CSS（`index.css` 末尾）**

```css
/* 仿真钢琴键盘 */
.practice .staff-wrap svg { max-width: 250px; }
.piano { position: relative; display: flex; width: 100%; max-width: 480px; height: 150px;
  margin: 10px auto 2px; border-radius: 6px; overflow: hidden; background: #0b1220;
  touch-action: none; user-select: none; }
.piano .key.white { flex: 1 1 0; background: linear-gradient(#f8fafc, #dbe3ea);
  border-right: 1px solid #94a3b8; border-radius: 0 0 4px 4px; }
.piano .key.white:active { background: #94a3b8; }
.piano .key.black { position: absolute; top: 0; height: 62%; z-index: 1;
  background: linear-gradient(#1e293b, #0f172a); border: 1px solid #000;
  border-radius: 0 0 3px 3px; }
.piano .key.black:active { background: #334155; }
```

- [ ] **Step 5: 跑测试确认 PASS + 门禁**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run src/ui/Piano.test.tsx   # 3 passed
npx vitest run                         # 全量回归
npx tsc -b                             # exit 0
```

- [ ] **Step 6: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/ui/Piano.tsx sightflash/src/ui/Piano.test.tsx sightflash/src/index.css
git commit -m "feat(sightflash): 仿真钢琴键盘组件 Piano.tsx（含单测）"
```

---

### Task P4: 练习屏接入琴键作答 + 钢琴音（删除旧提示音）

**Files:**
- Modify: `sightflash/src/ui/PracticeScreen.tsx`（整体替换）
- Delete: `sightflash/src/ui/sound.ts`
- Delete: `sightflash/src/ui/sound.test.ts`
- Modify: `sightflash/src/ui/SettingsScreen.tsx`（标签文案 提示音 → 声音，可选）
- Modify: `sightflash/README.md`（里程碑 A 特性行补琴键/钢琴音）

- [ ] **Step 1: 确认前置**：P1~P3 已落地（`piano.ts` 导出 `playPiano`；`session.ts` 导出 `answerKey`；`Piano.tsx` 存在）。`PracticeScreen.tsx` 当前 import `playFeedback from './sound'`。

- [ ] **Step 2: 整体替换 `PracticeScreen.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { createSession, answerTap, answerKey } from '../core/session';
import { finalizeSession } from '../core/finalize';
import { mulberry32 } from '../core/generator/generator';
import { midiToName, LETTER_PC } from '../core/notation/note';
import { playPiano } from './piano';
import { StaffView } from './StaffView';
import { NoteButton } from './NoteButton';
import { Piano } from './Piano';

const PITCH_BUTTONS = Object.keys(LETTER_PC); // C→B 插入序（与 letter 按钮一致）

export function PracticeScreen() {
  const { state, setState, repo, go } = useApp();
  const cfg = { stage: state.progress.stage, clef: state.settings.lastClef, durationSec: state.settings.durationSec };
  const seed = useRef(Math.floor(Math.random() * 2 ** 31));
  const [sess, setSess] = useState(() =>
    createSession({ ...cfg, rng: mulberry32(seed.current), wrong: state.progress.wrong }),
  );
  const [left, setLeft] = useState(cfg.durationSec);
  const finished = useRef(false);

  // 倒计时
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // 时间到 → 结算 → 落库（先落库成功再跳转，保证 ResultScreen 能读到最新记录）
  useEffect(() => {
    if (left > 0 || finished.current) return;
    finished.current = true;
    const now = new Date();
    const { progress, streak, daily, record } = finalizeSession(state, {
      correct: sess.correct, total: sess.total, durationSec: cfg.durationSec,
      history: sess.history, stage: cfg.stage, clef: cfg.clef, ts: now.getTime(),
    });
    repo.addSession(record)
      .catch((e) => console.warn('addSession failed', e))
      .finally(() => {
        setState((prev) => ({ ...prev, progress, streak, daily }));
        go('result');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const sound = state.settings.sound;

  // 音名按钮作答：判对播目标音；判错播“所选音名 @ 谱面音符八度”的错音。
  function onTap(label: string) {
    const pc = LETTER_PC[label];
    if (pc === undefined) return; // 防御：异常 label 直接忽略
    const target = sess.target.midi;
    const ok = pc === target % 12;
    playPiano(sound, ok ? target : Math.floor(target / 12) * 12 + pc);
    setSess((s) => answerTap(s, pc));
  }

  // 琴键作答：按下立即播该键音；判定交给 answerKey（精确八度）。
  function onKey(midi: number) {
    playPiano(sound, midi);
    setSess((s) => answerKey(s, midi));
  }

  const fb = sess.last === null ? 'none' : sess.last.result === 'correct' ? 'ok' : 'bad'; // 对齐样式 .fb.ok/.fb.bad
  const fbText =
    sess.last === null
      ? '看谱，点出这个音的名字（按钮或琴键）'
      : sess.last.result === 'correct'
        ? '✓ 对！'
        : `✗ 是 ${midiToName(sess.last.expectedMidi)}`;
  const clefName = sess.target.clef === 'treble' ? '高音谱' : '低音谱';

  return (
    <main className="screen practice">
      <div className="row space-between">
        <span>S{state.progress.stage} · {clefName}</span>
        <span className={left <= 5 ? 'timer warn' : 'timer'}>{left}s</span>
      </div>
      <StaffView midi={sess.target.midi} clef={sess.target.clef} />
      <div className={`fb ${fb}`} data-testid="feedback">
        {fbText}
      </div>
      <div className="row">
        {PITCH_BUTTONS.map((b) => (
          <NoteButton key={b} label={b} onClick={() => onTap(b)} />
        ))}
      </div>
      <Piano clef={sess.target.clef} onKey={onKey} />
    </main>
  );
}
```

说明：`Piano` 的 `clef` 取 `sess.target.clef`（每题的谱号，混合模式随题切换窗口）。练习屏反馈文案的默认引导语改了一下（提及琴键）——若与既有 App.test 断言冲突（现有测试没断言这句引导语），保持全量测试绿即可。

- [ ] **Step 3: 删除旧提示音文件**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git rm sightflash/src/ui/sound.ts sightflash/src/ui/sound.test.ts
```

确认全仓不再有 `from './sound'` / `playFeedback` 引用：
```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
grep -rn "sound'\|playFeedback" src || echo "no leftover"
```
（应为 no leftover。）

- [ ] **Step 4: （可选）Settings 标签与 README 文案**

`SettingsScreen.tsx` 第 10 行 `<span>提示音</span>` → `<span>声音</span>`（语义已从提示音扩为钢琴音）。

`README.md` 里程碑 A 特性行补一句（当前第 6 行）：
`看谱 → 点音名按钮或仿真钢琴琴键（可听该音钢琴音）。难度阶梯 S1~S5、错音加权复习、打卡/连击、速度曲线与准确率、本地数据（IndexedDB）。`

- [ ] **Step 5: 全量门禁**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run   # 全绿（56 - 4 旧提示音测试 + 各新增 = 依实际）
npx tsc -b       # exit 0
```

若 App.test / 其它组件测试因 PracticeScreen 加入 `Piano` 而失败，先查是否 render 抛错（Piano 无异步副作用，理论不该影响）；若有失败请如实报告，勿静默改断言掩盖。

- [ ] **Step 6: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/ui/PracticeScreen.tsx sightflash/src/ui/SettingsScreen.tsx sightflash/README.md
git commit -m "feat(sightflash): 练习屏接入琴键作答与钢琴音，移除旧提示音"
```

（注：Step 3 的 `git rm` 已把删除计入索引，Step 6 `git add` 会带上；如 SettingsScreen/README 未改可不 add 它们，但提交信息里的 feat 主体不变。）

---

## 覆盖自检

| 规格（§20） | 对应任务 |
|---|---|
| 20.1 双作答入口同屏 | P3 Piano + P4 布局 |
| 20.1 `answerKey` 精确八度 | P2 |
| 20.1 琴键窗口 C4~C6 / G2~G4 | P3 RANGE 常量 |
| 20.1 琴键不标字母 | P3（组件无文字） |
| 20.2 加法合成引擎 `piano.ts` | P1 |
| 20.2 按键即发该键音 | P4 onKey 先 playPiano |
| 20.2 判对播目标 / 判错播错音（音名错音=所选字母@目标八度） | P4 onTap 规则 |
| 20.2 不播正确答案音 | P4（错时仅错音，不播 target） |
| 20.2 替换移除 `sound.ts` | P4 Step 3 |
| 设置开关沿用 `settings.sound` | P4（sound = state.settings.sound） |
