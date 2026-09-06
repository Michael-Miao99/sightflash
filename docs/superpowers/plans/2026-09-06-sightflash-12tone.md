# 12 音变化音（练黑键）全局开关 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在认音模式加入「练黑键（变化音）」全局开关：开 → 出题池在当前谱号+当前 S 音域内补入黑键、谱面按 #/♭ 拼写渲染记号、音名板扩为 12 键（黑键双名）、错题回显用题面记法；关 → 行为与现在完全一致。

**Architecture:** 数据层新增 `type Gamut = 'natural'|'chromatic'`，只作为**可选**参数穿透 `poolForStage → chooseMidi → chooseQuestion → SessionConfig/Session`（缺省 natural，老调用/老测试构造零改动）。黑键 midi 每题用 rng 50/50 选 `acc: '#'|'b'` 记进 `Question.acc`；谱表定位恒用「拼写字母所在自然音」`letterMidi`（positions 的自然语义签名一律不动），记号只是 StaffView 在符头左侧多画一个 ♯/♭。UI 按 gamut 在 7 键 / 12 键音名板间切换（等音同键判音级）。

**Tech Stack:** React/TS + vitest(jsdom) + CSS。规格依据：设计文档 §24（2026-09-06 增补，已批准，commit `0e232a9`）。

**范围：** 只允许触碰下列 4 组文件的清单内文件，**不要碰** `src/core/notation/positions.ts`、`src/ui/Piano.tsx`、`src/ui/piano.ts`、`src/ui/landscape.ts`、首页/setup/result/stats 屏、`index.html`/manifest/vite 配置。
- Task 1（核心音高拼写 + 出题池）: `src/core/notation/note.ts`、`src/core/notation/note.test.ts`、`src/core/generator/stages.ts`、`src/core/generator/generator.ts`、`src/core/generator/generator.test.ts`
- Task 2（会话/存储穿透）: `src/core/session.ts`、`src/core/session.test.ts`、`src/core/storage/types.ts`、`src/core/storage/logic.ts`
- Task 3（界面/CSS/集成）: `src/ui/StaffView.tsx`、`src/ui/NoteButton.tsx`、`src/ui/PracticeScreen.tsx`、`src/ui/SettingsScreen.tsx`、`src/index.css`、`src/app/App.test.tsx`
- Task 4（README）: `README.md`

**环境注意（本机强制）：** 所有测试/类型/构建在 `sightflash/` 目录下执行；vitest 必须 `--maxWorkers=1`（默认并行 OOM）；类型门禁用 `npx tsc -b`（solution-style，`tsc --noEmit` 是空操作）；Windows 大小写不敏感——导入 `Piano.tsx` 写 `./Piano.tsx`、导入发声引擎写 `./piano.ts`，本计划不触碰 `piano.ts` 但改 `PracticeScreen.tsx` 时别动其 `import { playPiano } from './piano.ts'` 行。

---

### Task 1: 变化音拼写原语 + chromatic 出题池（note / stages / generator + 测试）

**Files:**
- Modify: `sightflash/src/core/notation/note.ts`
- Modify: `sightflash/src/core/notation/note.test.ts`
- Modify: `sightflash/src/core/generator/stages.ts`
- Modify: `sightflash/src/core/generator/generator.ts`
- Modify: `sightflash/src/core/generator/generator.test.ts`

- [ ] **Step 1: 给 `note.test.ts` 追加变化音拼写测试（先写失败）**

在 `note.test.ts` 顶部 import 行改为：
```ts
import { describe, it, expect } from 'vitest';
import { midiToName, nameToMidi, letterIndex, LETTER_PC, letterMidiOf, spelledName } from './note';
```
在文件末尾追加：
```ts
describe('note 变化音拼写（黑键双记法）', () => {
  it('letterMidiOf：黑键 # 取下自然音、b 取上自然音、无记号原样', () => {
    expect(letterMidiOf(61, '#')).toBe(60); // C#4 → 拼写字母 C4
    expect(letterMidiOf(61, 'b')).toBe(62); // Db4 → 拼写字母 D4
    expect(letterMidiOf(78, '#')).toBe(77); // F#5 → F5
    expect(letterMidiOf(78, 'b')).toBe(79); // Gb5 → G5
    expect(letterMidiOf(61, null)).toBe(61);
    expect(letterMidiOf(60, undefined)).toBe(60);
  });

  it('spelledName：升降与自然', () => {
    expect(spelledName(61, '#')).toBe('C#4');
    expect(spelledName(61, 'b')).toBe('Db4');
    expect(spelledName(63, 'b')).toBe('Eb4');
    expect(spelledName(63, '#')).toBe('D#4');
    expect(spelledName(73, 'b')).toBe('Db5');
    expect(spelledName(60, null)).toBe('C4');
    expect(spelledName(60, undefined)).toBe('C4');
  });

  it('spelledName 对自然音与 midiToName 一致', () => {
    for (const m of [60, 62, 71, 79, 43]) expect(spelledName(m, null)).toBe(midiToName(m));
  });
});
```

- [ ] **Step 2: 跑该测试确认失败**

Run（在 `sightflash/` 下）: `npx vitest run --maxWorkers=1 src/core/notation/note.test.ts`
Expected: FAIL（`letterMidiOf`/`spelledName` 未定义）。

- [ ] **Step 3: 用下面内容整体重写 `src/core/notation/note.ts`**

```ts
// 音高模型：统一用 MIDI 号表示音高（C4=60）。命名体系为音名 C~B。

export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type PitchClass = (typeof PITCH_CLASSES)[number];

/** 自然音字母 → 半音内音级（C=0 … B=11） */
export const LETTER_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export const LETTER_INDEX: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

/** 变化音记号类型：升号 / 降号。自然音无记号（null / 缺省）。 */
export type Accidental = '#' | 'b';

/** 取音级名（含升降号）。本 App natural 池内只含自然音。 */
export function midiToPc(midi: number): PitchClass {
  return PITCH_CLASSES[((midi % 12) + 12) % 12];
}

/** midi → "C4" 形音名（升号拼写为默认，natural 音名不受影响） */
export function midiToName(midi: number): string {
  const pc = midiToPc(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${pc}${octave}`;
}

/** "C4" 形音名 → midi；非法输入返回 null。仅支持 C~G 及可选 #。 */
export function nameToMidi(name: string): number | null {
  const m = /^([A-G])(#?)(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const semitone = LETTER_PC[m[1]] + (m[2] === '#' ? 1 : 0);
  const octave = parseInt(m[3], 10);
  return 12 * (octave + 1) + semitone;
}

/** 自然音字母的序号：C=0 … B=6 */
export function letterIndex(pc: string): number {
  return LETTER_INDEX[pc[0]] ?? 0;
}

/**
 * 变化音拼写 → 谱表定位音（自然音）：# 用其下方自然音（midi−1，如 C#4→C4），
 * b 用其上方自然音（midi+1，如 Db4→D4），无记号原样。仅黑键（pc∈{1,3,6,8,10}）
 * 存在 #/b 两种拼写；调用方应只对黑键传记号。
 */
export function letterMidiOf(midi: number, acc: Accidental | null | undefined): number {
  if (acc === '#') return midi - 1;
  if (acc === 'b') return midi + 1;
  return midi;
}

/** 含记号的音名：spelledName(61,'b') → "Db4"；自然音无 acc → 同 midiToName。 */
export function spelledName(midi: number, acc: Accidental | null | undefined): string {
  if (!acc) return midiToName(midi);
  const letterMidi = letterMidiOf(midi, acc); // 拼写字母所在音（自然音）
  const letter = midiToPc(letterMidi)[0];
  const octave = Math.floor(midi / 12) - 1;
  return `${letter}${acc}${octave}`;
}
```

要点：`midiToName/nameToMidi/letterIndex` 等旧导出**逐字保留**；只新增 `Accidental`、`letterMidiOf`、`spelledName`。

- [ ] **Step 4: 跑 note 测试确认通过**

Run: `npx vitest run --maxWorkers=1 src/core/notation/note.test.ts`
Expected: PASS（3 旧 describe + 1 新 describe 全绿）。

- [ ] **Step 5: 给 `generator.test.ts` 追加 chromatic 池与出题测试（先写失败）**

在 `src/core/generator/generator.test.ts` 顶部 import 不变（已有 `mulberry32, pickWeighted, chooseMidi, chooseQuestion` 与 `poolForStage, MAX_STAGE, clefUnlockStage`）。在文件末尾追加两个 describe：

```ts
describe('stages chromatic 池（练黑键）', () => {
  it('chromatic 池 = 自然前缀 ∪ 池内自然音上邻黑键（钉死不变量）', () => {
    for (const clef of ['treble', 'bass'] as const) {
      for (let s = 1; s <= MAX_STAGE; s++) {
        const nat = poolForStage(s, clef);
        const chrom = poolForStage(s, clef, 'chromatic');
        // 升序、去重
        expect(chrom).toEqual([...chrom].sort((a, b) => a - b));
        expect(new Set(chrom).size).toBe(chrom.length);
        // 上下界 = 自然池上下界（黑键不越界）
        expect(chrom[0]).toBe(Math.min(...nat));
        expect(chrom[chrom.length - 1]).toBe(Math.max(...nat));
        // 自然前缀完整保留
        for (const m of nat) expect(chrom).toContain(m);
        // 池内黑键唯一来自其下方自然音（C/D/F/G/A 上邻），E/B 之上不产生黑键
        for (const b of chrom) {
          if ([1, 3, 6, 8, 10].includes(b % 12)) {
            expect(nat).toContain(b - 1);
            expect([0, 2, 5, 7, 9]).toContain((b - 1) % 12);
          }
        }
      }
    }
  });

  it('S1 高音 chromatic 只扩 C#4/D#4；S3 高音凑满一个整八度 C4~B4', () => {
    expect(poolForStage(1, 'treble', 'chromatic')).toEqual([60, 61, 62, 63, 64]);
    expect(poolForStage(3, 'treble', 'chromatic')).toEqual(
      Array.from({ length: 12 }, (_, i) => 60 + i),
    );
  });
});

describe('generator 变化音出题', () => {
  it('chromatic 黑键题带 acc(#/b 之一)、自然题无 acc', () => {
    const rng = mulberry32(21);
    const chrom = poolForStage(5, 'treble', 'chromatic');
    const black = new Set(chrom.filter((m) => [1, 3, 6, 8, 10].includes(m % 12)));
    const accSeen = new Set<string>();
    let blackHit = 0;
    for (let i = 0; i < 800; i++) {
      const q = chooseQuestion(rng, 5, 'treble', {}, -1, 'chromatic');
      expect(chrom).toContain(q.midi);
      if (black.has(q.midi)) {
        blackHit++;
        expect(['#', 'b']).toContain(q.acc ?? '');
        accSeen.add(q.acc as string);
      } else {
        expect(q.acc).toBeUndefined();
      }
    }
    expect(blackHit).toBeGreaterThan(0);
    expect(accSeen.has('#')).toBe(true);
    expect(accSeen.has('b')).toBe(true);
  });

  it('缺省（natural）出题不含黑键、无 acc', () => {
    const rng = mulberry32(4);
    for (let i = 0; i < 60; i++) {
      const q = chooseQuestion(rng, 5, 'treble', {}, -1);
      expect([0, 2, 4, 5, 7, 9, 11]).toContain(q.midi % 12);
      expect(q.acc).toBeUndefined();
    }
  });
});
```

- [ ] **Step 6: 跑该测试确认失败**

Run: `npx vitest run --maxWorkers=1 src/core/generator/generator.test.ts`
Expected: FAIL（`poolForStage` 无第三参 / `chooseQuestion` 无 gamut 参，TS 编译与断言不通过）。

- [ ] **Step 7: 用下面内容整体重写 `src/core/generator/stages.ts` 与 `src/core/generator/generator.ts`**

`stages.ts`：
```ts
import type { Clef } from '../notation/positions';

export type MixedClef = Clef | 'mixed';

/** 音域：natural 只自然音（现状默认）；chromatic 在当前谱号+当前 S 音域内补入黑键 */
export type Gamut = 'natural' | 'chromatic';

export const MAX_STAGE = 5;

// 默认参数（可调）。高音谱以 C4 为锚向上、低音谱以 C4 为锚向下（含加线）。
// 只含自然音：TREBLE_UP 依次 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5（C4..G5）；
// BASS_DOWN 依次 C4 B3 A3 G3 F3 E3 D3 C3 B2 A2 G2（C4..G2）。
const TREBLE_UP = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79]; // C4..G5
const BASS_DOWN = [60, 59, 57, 55, 53, 52, 50, 48, 47, 45, 43]; // C4..G2

/** 每阶段高音/低音池的音数（S1 高音 3 音起，低音从 S2 加入） */
const SIZE: Record<number, { treble: number; bass: number }> = {
  1: { treble: 3, bass: 0 },
  2: { treble: 5, bass: 3 },
  3: { treble: 7, bass: 5 },
  4: { treble: 9, bass: 7 },
  5: { treble: TREBLE_UP.length, bass: BASS_DOWN.length },
};

/** 自然音母上方紧邻有黑键的半音（C/D/F/G/A → 有上邻黑键；E/B 无） */
const SHARPABLE_PC = new Set([0, 2, 5, 7, 9]);

function clampStage(stage: number): number {
  return Math.max(1, Math.min(MAX_STAGE, stage));
}

/** 某谱号的自然音前缀（保持既有顺序语义：高音升序、低音降序） */
function naturalSlice(stage: number, clef: Exclude<MixedClef, 'mixed'>): number[] {
  const s = clampStage(stage);
  return (clef === 'treble' ? TREBLE_UP : BASS_DOWN).slice(0, SIZE[s][clef]);
}

/** 在自然音前缀上补黑键：对每个自然音 m，若 m 上邻是黑键且不越池顶（m%12∈SHARPABLE_PC 且 m+1≤池顶），则加入 m+1。升序去重。 */
function chromaticize(naturals: readonly number[]): number[] {
  if (naturals.length === 0) return [];
  const top = Math.max(...naturals);
  const blacks = naturals
    .filter((m) => SHARPABLE_PC.has(m % 12))
    .map((m) => m + 1)
    .filter((m) => m <= top);
  return [...new Set([...naturals, ...blacks])].sort((a, b) => a - b);
}

/** 某谱号在某阶段的可用音符池。gamut='natural' 返回与旧版逐位一致的数组；'chromatic' 补入同音域黑键。 */
export function poolForStage(stage: number, clef: MixedClef, gamut: Gamut = 'natural'): number[] {
  if (gamut === 'chromatic') {
    if (clef === 'mixed') {
      return [...chromaticize(naturalSlice(stage, 'treble')), ...chromaticize(naturalSlice(stage, 'bass'))];
    }
    return chromaticize(naturalSlice(stage, clef));
  }
  const s = clampStage(stage);
  if (clef === 'mixed') {
    return [...TREBLE_UP.slice(0, SIZE[s].treble), ...BASS_DOWN.slice(0, SIZE[s].bass)];
  }
  return (clef === 'treble' ? TREBLE_UP : BASS_DOWN).slice(0, SIZE[s][clef]);
}

/** 谱号解锁所需阶段：高音 S1、低音 S2、混合 S3 */
export function clefUnlockStage(clef: MixedClef): number {
  return clef === 'treble' ? 1 : clef === 'bass' ? 2 : 3;
}
```

`generator.ts`：
```ts
import type { Clef } from '../notation/positions';
import type { MixedClef, Gamut } from './stages';
import { poolForStage } from './stages';
import type { Accidental } from '../notation/note';

/** 可注入种子的 PRNG（mulberry32）—— 测试可复现 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(rng: () => number, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** 黑键半音集合（决定某 midi 是否为黑键 / 是否有 #/b 两种拼写） */
const BLACK_PC = new Set([1, 3, 6, 8, 10]);

/** 在单谱池内抽一个音。wrong[midi] 越高权重越大；相邻不重复（最多重抽 5 次）。gamut 决定池是否含黑键。 */
export function chooseMidi(
  rng: () => number,
  stage: number,
  clef: MixedClef,
  wrong: Record<number, number>,
  prev: number,
  gamut: Gamut = 'natural',
): number {
  const pool = poolForStage(stage, clef, gamut);
  if (pool.length === 0) throw new Error(`empty note pool: clef=${clef} stage=${stage}`);
  const weights = pool.map((m) => 1 + Math.min(wrong[m] ?? 0, 3));
  let chosen = pickWeighted(rng, pool, weights);
  if (pool.length > 1) {
    let guard = 0;
    while (chosen === prev && guard++ < 5) chosen = pickWeighted(rng, pool, weights);
  }
  return chosen;
}

export interface Question {
  midi: number;
  clef: Clef;
  /** 变化音拼写：# / ♭。自然音为 undefined。仅 chromatic 池的黑键题会被赋值。 */
  acc?: Accidental;
}

/**
 * 出下一题。选择谱号：clef='mixed' 时每道题 50/50 掷高音/低音谱；其余用指定谱。
 * 再在对应池内抽音（prev 为上一题的 midi，避免相邻同音）。chromatic 下抽中黑键时用 rng 50/50 记 acc。
 */
export function chooseQuestion(
  rng: () => number,
  stage: number,
  clef: MixedClef,
  wrong: Record<number, number>,
  prev: number,
  gamut: Gamut = 'natural',
): Question {
  const sub: Clef = clef === 'mixed' ? (rng() < 0.5 ? 'treble' : 'bass') : clef;
  const midi = chooseMidi(rng, stage, sub, wrong, prev, gamut);
  const acc: Accidental | undefined =
    gamut === 'chromatic' && BLACK_PC.has(midi % 12) ? (rng() < 0.5 ? '#' : 'b') : undefined;
  return { midi, clef: sub, acc };
}
```

要点：`natural` 路径的池数组由原表达式构造（逐位一致）；`chooseMidi/chooseQuestion` 新增**可选尾参** `gamut`，旧调用不传则 natural。

- [ ] **Step 8: 跑 generator 测试 + note 回归**

Run: `npx vitest run --maxWorkers=1 src/core/generator/generator.test.ts src/core/notation/note.test.ts`
Expected: PASS。

- [ ] **Step 9: 提交 Task 1**

```bash
git add src/core/notation/note.ts src/core/notation/note.test.ts src/core/generator/stages.ts src/core/generator/generator.ts src/core/generator/generator.test.ts
git commit -m "feat(sightflash): 变化音拼写原语 + chromatic 出题池（§24 数据层）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

- [ ] **Step 10: 自检（向主会话报告）**
  - `Accidental/letterMidiOf/spelledName` 已加且旧导出逐字保留；`positions.ts` 未动。
  - `Gamut` 导出于 stages；`poolForStage(stage, clef, gamut='natural')` natural 数组与旧完全一致；chromatic 规则 = SHARPABLE_PC + `m+1≤池顶`。
  - `Question.acc?`、`chooseQuestion(...gamut)`、`chooseMidi(...gamut)` 均为可选尾参。
  - generator + note 测试绿。状态：DONE / DONE_WITH_CONCERNS / BLOCKED。

---

### Task 2: 会话与设置数据层穿透（session / storage + 测试）

**Files:**
- Modify: `sightflash/src/core/session.ts`
- Modify: `sightflash/src/core/session.test.ts`
- Modify: `sightflash/src/core/storage/types.ts`
- Modify: `sightflash/src/core/storage/logic.ts`

- [ ] **Step 1: 给 `session.test.ts` 追加 gamut 穿透测试（先写失败）**

在文件末尾追加：
```ts
describe('session 变化音 gamut 穿透', () => {
  it('chromatic 会话可出黑键目标且带合法 acc', () => {
    let s: Session | null = null;
    for (let seed = 1; seed < 400 && !s; seed++) {
      const c = createSession({ stage: 3, clef: 'treble', durationSec: 60, rng: mulberry32(seed), wrong: {}, gamut: 'chromatic' });
      if ([1, 3, 6, 8, 10].includes(c.target.midi % 12)) s = c;
    }
    expect(s).not.toBeNull();
    expect(['#', 'b']).toContain(s!.target.acc);
  });

  it('缺省 gamut 的老构造保持自然音行为、无 acc', () => {
    const s = createSession({ stage: 3, clef: 'treble', durationSec: 60, rng: mulberry32(1), wrong: {} });
    expect([0, 2, 4, 5, 7, 9, 11]).toContain(s.target.midi % 12);
    expect(s.target.acc).toBeUndefined();
  });

  it('黑键题答错按音级停留、答对推进', () => {
    let s: Session | null = null;
    for (let seed = 1; seed < 400 && !s; seed++) {
      const c = createSession({ stage: 3, clef: 'treble', durationSec: 60, rng: mulberry32(seed), wrong: {}, gamut: 'chromatic' });
      if ([1, 3, 6, 8, 10].includes(c.target.midi % 12)) s = c;
    }
    expect(s).not.toBeNull();
    const sess = s!;
    const midi = sess.target.midi;
    const wrong = answerTap(sess, (midi % 12 + 1) % 12); // 按音级错答
    expect(wrong.last?.result).toBe('wrong');
    expect(wrong.target.midi).toBe(midi); // 停留
    const ok = answerTap(wrong, midi % 12);
    expect(ok.last?.result).toBe('correct');
    expect(ok.correct).toBe(wrong.correct + 1);
    expect(ok.target).not.toBe(wrong.target); // 推进换新题对象
  });
});
```

- [ ] **Step 2: 跑该测试确认失败**

Run: `npx vitest run --maxWorkers=1 src/core/session.test.ts`
Expected: FAIL（SessionConfig/Session 尚无 gamut 字段，TS 报错）。

- [ ] **Step 3: 改 `src/core/session.ts`（4 处）**

在 import 区把第 1 行改成：
```ts
import type { MixedClef, Gamut } from './generator/stages';
```
`SessionConfig` 与 `Session` 接口各加一行 `gamut?: Gamut;`（放在 `wrong` 字段后）：
```ts
export interface SessionConfig {
  stage: number;
  clef: MixedClef;
  durationSec: number;
  rng: () => number;
  wrong: Record<number, number>;
  gamut?: Gamut;
}
```
```ts
export interface Session {
  stage: number;
  clef: MixedClef;
  durationSec: number;
  rng: () => number;
  wrong: Record<number, number>;
  gamut?: Gamut;
  target: Question;
  correct: number;
  total: number;
  history: HistoryItem[];
  last: HistoryItem | null;
}
```
`createSession` 第一行改为：
```ts
  const target = chooseQuestion(c.rng, c.stage, c.clef, c.wrong, -1, c.gamut);
```
`answerTap` 与 `answerKey` 各有一行 `const target = ok ? chooseQuestion(s.rng, s.stage, s.clef, s.wrong, s.target.midi) : s.target;`，把其中的 `chooseQuestion(...)` 调用末尾追加尾参 `, s.gamut`（两处：answerTap 与 answerKey 各一处，参数名均以 `s.` 开头，勿改其他）。

- [ ] **Step 4: 改 `src/core/storage/types.ts`**

把顶部 import 与 `Settings` 接口改成：
```ts
import type { MixedClef, Gamut } from '../generator/stages';

export type Mode = 'tap'; // 里程碑 B 加 'play'（跟弹）

export interface Progress {
  stage: number;
  wrong: Record<number, number>;
}

export interface Settings {
  sound: boolean;
  durationSec: number; // 30 | 60
  lastMode: Mode;
  lastClef: MixedClef;
  gamut: Gamut; // 练黑键（变化音）全局开关
}
```
（其余接口不变。）

- [ ] **Step 5: 改 `src/core/storage/logic.ts` 的 `defaultState`**

`settings` 行改为：
```ts
    settings: { sound: true, durationSec: 60, lastMode: 'tap', lastClef: 'treble', gamut: 'natural' },
```

- [ ] **Step 6: 跑 session 测试 + 存储回归**

Run: `npx vitest run --maxWorkers=1 src/core/session.test.ts src/core/storage/memory.test.ts src/core/storage/logic.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交 Task 2**

```bash
git add src/core/session.ts src/core/session.test.ts src/core/storage/types.ts src/core/storage/logic.ts
git commit -m "feat(sightflash): Session/Settings 可选 gamut 穿透（§24，老调用缺省 natural）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

- [ ] **Step 8: 自检（向主会话报告）**
  - `SessionConfig.gamut?/Session.gamut?` 可选；`createSession/answerTap/answerKey` 透传尾参；`session.test.ts` 里 `makeSession`（无 gamut 的 Session 字面量）未改仍编译。
  - `Settings.gamut: Gamut`、`defaultState` 含 `gamut:'natural'`；老存档读取缺字段在 UI 层用 `?? 'natural'`（Task 3 落地）。
  - session + memory/logic 测试绿。状态：DONE / DONE_WITH_CONCERNS / BLOCKED。

---

### Task 3: UI——记号渲染、12 键音名板、设置开关、CSS（含集成测试）

**Files:**
- Modify: `sightflash/src/ui/StaffView.tsx`
- Modify: `sightflash/src/ui/NoteButton.tsx`
- Modify: `sightflash/src/ui/PracticeScreen.tsx`
- Modify: `sightflash/src/ui/SettingsScreen.tsx`
- Modify: `sightflash/src/index.css`
- Modify: `sightflash/src/app/App.test.tsx`

- [ ] **Step 1: 先给 `App.test.tsx` 追加两个集成测试（先写失败）**

在 `describe('AppRoot', ...)` 内、放在「设置页可打开」用例之后，追加：
```tsx
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

  it('设置开练黑键：设置持久化，练习屏音名板 12 键含 5 个双名黑键键', async () => {
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
```

- [ ] **Step 2: 跑该测试确认失败**

Run: `npx vitest run --maxWorkers=1 src/app/App.test.tsx`
Expected: 至少第 2 个新用例 FAIL（尚无 `gamut-toggle`，且 note-btn 数量断言在 12 键未实现前不满足）。

- [ ] **Step 3: 重写 `src/ui/NoteButton.tsx`**

```tsx
export type NoteButtonVariant = 'natural' | 'black';

/** 音名板按钮。variant='black' 的黑键键用 .black-name 配色（双名标注，如 C#/Db）。 */
export function NoteButton({
  label,
  onClick,
  variant = 'natural',
}: {
  label: string;
  onClick: () => void;
  variant?: NoteButtonVariant;
}) {
  return (
    <button type="button" className={`note-btn${variant === 'black' ? ' black-name' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}
```

- [ ] **Step 4: 重写 `src/ui/StaffView.tsx`（加可选 acc 与记号字形）**

```tsx
import { layoutStaffNote } from '../core/notation/positions';
import type { Clef } from '../core/notation/positions';
import { letterMidiOf } from '../core/notation/note';
import type { Accidental } from '../core/notation/note';

const SPACE = 16; // px / 谱表步
const VIEW_STEPS = 17; // viewBox 高 = 17 步 = 272px
const ANCHOR_STEP = 13; // y=0（顶边）对应的谱表步；step 越往下越小
const SVG_W = 320;
const LINES = [0, 2, 4, 6, 8]; // 五条线自下而上：步 0 底线(E4/G2) ~ 步 8 顶线(F5/A3)
const clefGlyph: Record<Clef, string> = { treble: '𝄞', bass: '𝄢' };
const ACC_GLYPH: Record<Accidental, string> = { '#': '♯', b: '♭' };

// SVG y 向下增长；谱表步越大音越高、画得越靠上，故 y 越小。
const stepToY = (s: number) => (ANCHOR_STEP - s) * SPACE;

/** 五线谱音符。acc 为变化音拼写：画谱恒用「拼写字母所在自然音」letterMidi 定位
 *  （positions 仍是自然语义），记号 ♯/♭ 画在符头左侧。acc 缺省/空 = 自然音。 */
export function StaffView({ midi, clef, acc }: { midi: number; clef: Clef; acc?: Accidental | null }) {
  const lm = letterMidiOf(midi, acc ?? null); // 拼写字母所在音（自然音）
  const { step, ledgerLines } = layoutStaffNote(lm, clef);
  const H = VIEW_STEPS * SPACE;
  const cy = stepToY(step);
  return (
    <div className="staff-wrap">
      <svg data-testid="staff" viewBox={`0 0 ${SVG_W} ${H}`} style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }}>
        {/* 谱号：基线大致落在谱中央附近 */}
        <text data-testid="clef" x={14} y={stepToY(clef === 'treble' ? 2 : 0) + 6} fontSize={52}
          fill="#cbd5e1" fontFamily="'Noto Music','Segoe UI Symbol',serif">
          {clefGlyph[clef]}
        </text>
        {LINES.map((l) => (
          <line key={l} className="staff-line" x1={60} x2={SVG_W - 16} y1={stepToY(l)} y2={stepToY(l)}
            stroke="#64748b" strokeWidth={1.5} />
        ))}
        {acc != null && (
          <text data-testid="accidental" x={182} y={cy + 8} textAnchor="end" fontSize={30}
            fill="#f8fafc" fontFamily="'Noto Music','Segoe UI Symbol',serif">
            {ACC_GLYPH[acc]}
          </text>
        )}
        {ledgerLines.map((l) => (
          <line key={l} className="ledger" x1={186} x2={246} y1={stepToY(l)} y2={stepToY(l)}
            stroke="#cbd5e1" strokeWidth={1.5} />
        ))}
        <ellipse className="note-head" cx={216} cy={cy} rx={10} ry={8} fill="#f8fafc"
          transform={`rotate(-20 216 ${cy})`} />
        <line x1={224} x2={228} y1={cy - 4} y2={cy - 46} stroke="#f8fafc" strokeWidth={2.5} />
      </svg>
    </div>
  );
}
```
要点：记号以 `textAnchor=end` 锚在 x=182，右缘在 182 → 左于加线起点 186、符头左缘 206（24px 间距），纵向上即使越界黑键（高音 C#4 / 低音 A#3 自带加线）同行也不压线；自然音 acc 缺省渲染与旧版逐节点一致（无新增元素）。

- [ ] **Step 5: 重写 `src/ui/PracticeScreen.tsx`（gamut 读取、12 键音名板、acc 传谱面、错题回显题面记法）**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { createSession, answerTap, answerKey } from '../core/session';
import { finalizeSession } from '../core/finalize';
import { mulberry32 } from '../core/generator/generator';
import { spelledName, LETTER_PC } from '../core/notation/note';
import { playPiano } from './piano.ts';
import { requestLandscape } from './landscape';
import { StaffView } from './StaffView';
import { NoteButton } from './NoteButton';
import { Piano } from './Piano.tsx';

const ROTATE_HINT_BASE = '横屏使用键位更宽 ↻';
const ROTATE_HINT_MANUAL = '请手动旋转手机 ↻';

/** 音名板键定义：label 按钮文字；pc 判对音级；black 黑键键（双名、配色区分） */
interface BoardKey { label: string; pc: number; black: boolean; }

/** 自然 7 键：C…B（LETTER_PC 插入序，与既有按钮一致） */
const NATURAL_KEYS: BoardKey[] = Object.entries(LETTER_PC).map(([label, pc]) => ({ label, pc, black: false }));

/** 黑键 5 键双名：pc ∈{1,3,6,8,10}，等音同键同 pc */
const BLACK_KEY_LABELS: ReadonlyArray<[number, string]> = [
  [1, 'C#/Db'], [3, 'D#/Eb'], [6, 'F#/Gb'], [8, 'G#/Ab'], [10, 'A#/Bb'],
];

/** chromatic 12 键：按音级 0→11 排（C C# D D# E F F# G G# A A# B） */
const CHROMATIC_KEYS: BoardKey[] = (() => {
  const byPc = new Map<number, BoardKey>(NATURAL_KEYS.map((k) => [k.pc, k]));
  for (const [pc, label] of BLACK_KEY_LABELS) byPc.set(pc, { label, pc, black: true });
  return Array.from({ length: 12 }, (_, pc) => byPc.get(pc)!);
})();

export function PracticeScreen() {
  const { state, setState, repo, go } = useApp();
  const gamut = state.settings.gamut ?? 'natural'; // 老存档缺字段按 natural
  const cfg = { stage: state.progress.stage, clef: state.settings.lastClef, durationSec: state.settings.durationSec, gamut };
  const seed = useRef(Math.floor(Math.random() * 2 ** 31));
  const [sess, setSess] = useState(() =>
    createSession({ ...cfg, rng: mulberry32(seed.current), wrong: state.progress.wrong }),
  );
  const [left, setLeft] = useState(cfg.durationSec);
  const finished = useRef(false);
  const [hintMsg, setHintMsg] = useState(ROTATE_HINT_BASE);

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

  // 音名板作答（按音级）：判对播目标音；判错播“所选音级 @ 谱面音符八度”的错音。
  function onTap(pc: number) {
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

  // 横屏提示：点击尝试全屏/锁定横屏；浏览器不支持时改为“请手动旋转”的提示。
  function onRotateHint() {
    void requestLandscape().then((ok) => setHintMsg(ok ? ROTATE_HINT_BASE : ROTATE_HINT_MANUAL));
  }

  const fb = sess.last === null ? 'none' : sess.last.result === 'correct' ? 'ok' : 'bad'; // 对齐样式 .fb.ok/.fb.bad
  const fbText =
    sess.last === null
      ? '看谱，点出这个音的名字（按钮或琴键）'
      : sess.last.result === 'correct'
        ? '✓ 对！'
        : `✗ 是 ${spelledName(sess.target.midi, sess.target.acc)}`; // 错题回显用题面拼写（答错时 target 停留）
  const clefName = sess.target.clef === 'treble' ? '高音谱' : '低音谱';
  const chromatic = gamut === 'chromatic';
  const boardKeys = chromatic ? CHROMATIC_KEYS : NATURAL_KEYS;

  return (
    <main className="screen practice">
      <button type="button" className="rotate-hint" data-testid="rotate-hint" onClick={onRotateHint}>{hintMsg}</button>
      <div className="row space-between">
        <span>S{state.progress.stage} · {clefName}</span>
        <span className={left <= 5 ? 'timer warn' : 'timer'}>{left}s</span>
      </div>
      <StaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />
      <div className={`fb ${fb}`} data-testid="feedback">
        {fbText}
      </div>
      <div className={`row note-keys${chromatic ? ' chromatic' : ''}`}>
        {boardKeys.map((k) => (
          <NoteButton key={k.label} label={k.label} variant={k.black ? 'black' : 'natural'} onClick={() => onTap(k.pc)} />
        ))}
      </div>
      <Piano onKey={onKey} />
    </main>
  );
}
```
要点：删掉 `PITCH_BUTTONS` 与旧 `onTap(label)`；错题回显从 `midiToName(sess.last.expectedMidi)` 改为 `spelledName(sess.target.midi, sess.target.acc)`（答错 target 停留，取题面记法）；`Piano.tsx`/`./piano.ts` 导入行与调用保持原样（别删那行注释）。

- [ ] **Step 6: 改 `src/ui/SettingsScreen.tsx`（加练黑键开关行）**

在「声音」行的 `</div>` 之后、「每轮时长」行之前插入：
```tsx
        <div className="row"><span>练黑键（变化音）</span>
          <button className="sel small" data-testid="gamut-toggle" onClick={() => setState((p) => ({
            ...p, settings: { ...p.settings, gamut: (p.settings.gamut ?? 'natural') === 'chromatic' ? 'natural' : 'chromatic' },
          }))}>
            {(state.settings.gamut ?? 'natural') === 'chromatic' ? '开' : '关'}
          </button>
        </div>
```

- [ ] **Step 7: 改 `src/index.css`（12 键音名板配色与版式）**

(a) 在 `.note-btn { … }`（现第 19 行）之后插入基类块：
```css
/* 12 键音名板（练黑键=chromatic）：黑键键琥珀配色；竖屏极窄可换行 */
.note-keys.chromatic { flex-wrap: wrap; row-gap: 6px; }
.note-keys.chromatic .note-btn { flex: 1 1 36px; min-width: 0; max-width: 46px; font-size: 0.72rem; padding: 0 2px; }
.note-btn.black-name { color: #fbbf24; border-color: #8a5a00; }
```
(b) 在文件末尾 `@media (orientation: landscape)` 块内、`.practice .note-btn { … }` 那行**之后**加一行（横屏放宽到一行放得下、字号回升）：
```css
  .practice .note-keys.chromatic .note-btn { font-size: 0.95rem; max-width: 64px; }
```
除此之外**不碰**横屏媒体块任何既有规则、竖屏基类、`.c4`、`.piano` 等。

- [ ] **Step 8: 跑 App 集成测试确认通过**

Run: `npx vitest run --maxWorkers=1 src/app/App.test.tsx`
Expected: PASS（新增 2 用例 + 原有用例）。若断言 `C#/Db` 按钮等有 label 转义问题，允许在测试里改用 `document.querySelector('.note-btn.black-name')` 数量断言并保证仍覆盖 12 键与 5 黑键键。

- [ ] **Step 9: 全量回归 + 类型门禁 + 构建**

Run（在 `sightflash/` 下）:
- `npx vitest run --maxWorkers=1` → 全绿
- `npx tsc -b` → exit 0
- `npm run build` → 成功产出 `dist/`

- [ ] **Step 10: headless 视觉冒烟（可选，能做就做）**

若本机可用 headless Chrome：设置里开「练黑键」→ 高音谱 S1 起进练习屏，分别以 640×360 与 920×430 横屏视口截图，确认：12 键单排铺满、黑键键(琥珀)与自然键清晰、谱面黑键音符带清晰 ♯/♭ 记号且不与加线重叠。若字号在 640 宽挤到换行，只允许按 §24.5 微调 `.note-keys.chromatic .note-btn` 的 `font-size / max-width` 或媒体块内的对应行，并在提交说明记录实测视口。此步不可用则如实说明，交主会话真机验收。

- [ ] **Step 11: 提交 Task 3**

```bash
git add src/ui/StaffView.tsx src/ui/NoteButton.tsx src/ui/PracticeScreen.tsx src/ui/SettingsScreen.tsx src/index.css src/app/App.test.tsx
git commit -m "feat(sightflash): 练黑键 UI——12 键双名音名板 + 谱面 ♯/♭ 记号 + 设置开关（§24）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

- [ ] **Step 12: 自检（向主会话报告）**
  - StaffView 只加可选 `acc` 与一个记号 `<text>`，自然音渲染不变；positions 未动。
  - PracticeScreen：7↔12 键切换、onTap 按音级、错题回显 `spelledName(target)`、`<StaffView acc>`、cfg.gamut。
  - SettingsScreen 有 `gamut-toggle`；defaultState/老存档读缺字段均 `?? 'natural'`。
  - App 集成 2 新用例 + 全量 vitest 绿 + `tsc -b` + build 成功。
  - 状态：DONE / DONE_WITH_CONCERNS / BLOCKED。

---

### Task 4: README 里程碑 A 措辞同步

**Files:**
- Modify: `sightflash/README.md`

- [ ] **Step 1: 第 7 行提示句补一句**

在 `…键盘高度随屏高自适应。` 之后追加：
`设置页可开「练黑键（变化音）」：开后在当前音域补入升降号、谱面画 ♯/♭、音名板扩成 12 键（黑键键双名标注）。`
（该行其余文字保持原样。）

- [ ] **Step 2: 验收清单加一项**

在 `- [ ] 混合模式换谱时键盘不随谱切换…` 项之后插入：
`- [ ] 开「练黑键」后同一轮能碰到升降号：谱面记号清晰、12 键音名板与仿真琴键黑键都能答对；关掉回到 7 键纯自然音`

- [ ] **Step 3: 提交 Task 4**

```bash
git add README.md
git commit -m "docs(sightflash): README 同步练黑键（变化音）开关说明（§24）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 收尾（实现完成后整体复跑）

在最后一次 commit 之后、报告之前，整体复跑一次：
- `npx vitest run --maxWorkers=1` → 全绿
- `npx tsc -b` → exit 0
- `npm run build` → 成功

**验收（真机，交 boss 做，不在本任务自动判定）：** §24.6 清单：自然默认 7 键全流程行为与旧版一致；开「练黑键」后高/低音题都能碰到升降号、谱面记号清晰、12 键面板与琴键黑键均能答对；错题回显用题面记法（如 Db4）；设置开关持久化、老存档缺字段按 natural。
