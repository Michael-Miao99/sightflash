# SightFlash 里程碑 A（认音模式 + PWA）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成 SightFlash（五线速读）的可运行骨架 + **认音模式**（看谱→点音名按钮）+ 难度阶梯/打卡/统计 + PWA 离线安装。本计划结束时产品可在手机上玩认音训练。

**Architecture:** Vite + React + TypeScript PWA。乐理/出题/存储/统计等核心逻辑为**纯 TS（core 层，不依赖框架，可单测）**，UI 层只做渲染与交互。出题引擎与答题方式解耦，为里程碑 B（跟弹模式）预留扩展点。

**Tech Stack:** Vite 5+、React 18、TypeScript、vitest + @testing-library/react、vite-plugin-pwa、idb（IndexedDB）、pngjs（生成图标，仅 dev）。

**设计文档：** `docs/superpowers/specs/2026-09-05-sightflash-design.md`（对照第 5-15 节）。

**关键约定：**
- 音高一律用 MIDI 号（C4=60）。音级（pitch class）= `midi % 12`，自然音为 {0,2,4,5,7,9,11}。
- 认音题判定**只看音级**（C4 与 C5 都答 C）——因为题目考的是"读谱认名"，不含八度。
- **每道题 = `{ midi, clef }`**。混合模式每道题随机决定用高音谱还是低音谱（同一音可跨谱出现，正是训练点）。
- 界面文案简体中文；全程 TDD（纯逻辑先写失败测试）；每个 Task 结束提交一次。
- 里程碑 B（跟弹/麦克风）不在本计划，见文件末尾说明。

---

### Task 1: 项目脚手架 + 工具链配置

**Files:**
- Create: `sightflash/` 全部骨架
- Create: `scripts/gen-icons.mjs`
- Create: `src/test/setup.ts`
- Modify: `vite.config.ts`、`package.json`、`src/main.tsx`

- [ ] **Step 1: 用 Vite 创建 React+TS 项目并安装依赖**

```bash
cd "d:/OneDrive/claude_project/cleaner"
npm create vite@latest sightflash -- --template react-ts
cd sightflash
npm install
npm install idb
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom vite-plugin-pwa pngjs @types/pngjs
```
Expected: `npm install` 无报错，目录含 `src/`、`index.html`、`vite.config.ts`。

- [ ] **Step 2: 配置 package.json 脚本**

在 `package.json` 的 `scripts` 中加入：

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "node scripts/gen-icons.mjs"
```

- [ ] **Step 3: 重写 vite.config.ts（含 vitest 与 PWA）**

`vite.config.ts` 全文：

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '五线速读',
        short_name: '五线速读',
        description: '识谱反应训练器：把五线谱练成条件反射',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

- [ ] **Step 4: 添加测试 setup**

`src/test/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: 生成 PWA 图标脚本**

`scripts/gen-icons.mjs` 全文：

```js
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

function draw(size) {
  const png = new PNG({ width: size, height: size });
  const bg = [15, 23, 42];
  const ink = [255, 255, 255];
  const accent = [56, 189, 248];
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (size * y + x) * 4;
    png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, bg);
  const cx = size / 2, cy = size / 2;
  const noteR = size * 0.16;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - cx) / 1.25, dy = y - cy;
    if (dx * dx + dy * dy <= noteR * noteR) set(x, y, accent);
  }
  const half = size * 0.22;
  for (let l = 0; l < 5; l++) {
    const yy = Math.round(cy + half * (l - 2));
    for (let x = Math.round(size * 0.14); x < size * 0.86; x++) {
      set(Math.round(x), yy, ink);
      set(Math.round(x), yy - 1, ink);
    }
  }
  const stemX = Math.round(cx + noteR * 0.7);
  for (let y = Math.round(cy - noteR); y > Math.round(cy - size * 0.38); y--) set(stemX, y, ink);
  return png;
}

for (const s of [192, 512]) {
  writeFileSync(join(outDir, `icon-${s}.png`), PNG.sync.write(draw(s)));
}
console.log('icons generated');
```

- [ ] **Step 6: 运行图标脚本并确认产物**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npm run icons
```
Expected: 输出 `icons generated`，`public/` 出现 `icon-192.png`、`icon-512.png`。

- [ ] **Step 7: 删模板演示文件**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
rm -f src/App.css src/assets/react.svg src/App.tsx
```

- [ ] **Step 8: 重写 src/main.tsx**

`src/main.tsx` 全文：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

（`src/app/App.tsx` 在 Task 8 创建；在它出现前 `tsc` 会报错，属预期中间态。）

- [ ] **Step 9: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash
git commit -m "chore(sightflash): 脚手架 Vite+React+TS、vitest、PWA、图标生成"
```

---

### Task 2: 乐理核心 note.ts（音高模型）

**Files:**
- Create: `src/core/notation/note.ts`
- Test: `src/core/notation/note.test.ts`

- [ ] **Step 1: 写失败测试**

`src/core/notation/note.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { midiToPc, midiToName, nameToMidi, letterIndex, LETTER_PC } from './note';

describe('note 音高模型', () => {
  it('midiToName: C4=60, A4=69, G2=43', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(43)).toBe('G2');
  });

  it('nameToMidi 与 midiToName 互逆', () => {
    expect(nameToMidi('C4')).toBe(60);
    expect(nameToMidi('A4')).toBe(69);
    expect(nameToMidi('G2')).toBe(43);
    expect(nameToMidi('B4')).toBe(71);
    expect(nameToMidi('bad')).toBeNull();
  });

  it('letterIndex: C=0, E=2, G=4, B=6', () => {
    expect(letterIndex('C')).toBe(0);
    expect(letterIndex('E')).toBe(2);
    expect(letterIndex('G')).toBe(4);
    expect(letterIndex('B')).toBe(6);
  });

  it('LETTER_PC: 按钮字母 → 音级半音', () => {
    expect(LETTER_PC['C']).toBe(0);
    expect(LETTER_PC['D']).toBe(2);
    expect(LETTER_PC['E']).toBe(4);
    expect(LETTER_PC['F']).toBe(5);
    expect(LETTER_PC['G']).toBe(7);
    expect(LETTER_PC['A']).toBe(9);
    expect(LETTER_PC['B']).toBe(11);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/notation/note.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现 note.ts**

`src/core/notation/note.ts`：

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

/** 取音级名（含升降号）。本 App 池内只含自然音。 */
export function midiToPc(midi: number): PitchClass {
  return PITCH_CLASSES[((midi % 12) + 12) % 12];
}

/** midi → "C4" 形音名 */
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/notation/note.test.ts`
Expected: PASS（4 组用例）。

- [ ] **Step 5: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/core/notation
git commit -m "feat(sightflash): 音高模型 note.ts"
```

---

### Task 3: 乐理核心 positions.ts（五线位置数学）

**Files:**
- Create: `src/core/notation/positions.ts`
- Test: `src/core/notation/positions.test.ts`

- [ ] **Step 1: 写失败测试**

`src/core/notation/positions.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { staffStep, ledgerLinesOf, layoutStaffNote } from './positions';

describe('positions 五线位置', () => {
  it('高音谱底线 E4，相邻线/间各差 1 步，五线在 0,2,4,6,8', () => {
    expect(staffStep(64, 'treble')).toBe(0); // E4 底线
    expect(staffStep(65, 'treble')).toBe(1); // F4 线间
    expect(staffStep(67, 'treble')).toBe(2); // G4 二线
    expect(staffStep(71, 'treble')).toBe(4); // B4 三线
    expect(staffStep(74, 'treble')).toBe(6); // D5 四线
    expect(staffStep(77, 'treble')).toBe(8); // F5 顶线
  });

  it('高音谱低于底线：D4 线间、C4 下加一线', () => {
    expect(staffStep(62, 'treble')).toBe(-1); // D4 底线下一间
    expect(staffStep(60, 'treble')).toBe(-2); // C4 下加一线
  });

  it('低音谱底 G2=0；C4 在上方', () => {
    expect(staffStep(43, 'bass')).toBe(0);  // G2 底线
    expect(staffStep(47, 'bass')).toBe(2);  // B2 二线
    expect(staffStep(48, 'bass')).toBe(3);  // C3 线间
    expect(staffStep(57, 'bass')).toBe(8);  // A3 顶线
    expect(staffStep(60, 'bass')).toBe(10); // C4 上加一线
  });

  it('超出五线：线位音符有加线，空间音符无加线', () => {
    expect(ledgerLinesOf(60, 'treble')).toEqual([-2]);     // C4 下加一线
    expect(ledgerLinesOf(62, 'treble')).toEqual([]);       // D4 是空间：无加线
    expect(ledgerLinesOf(79, 'treble')).toEqual([]);       // G5 顶线上方空间：无加线
    expect(ledgerLinesOf(81, 'treble')).toEqual([10]);     // A5 上加一线
    expect(ledgerLinesOf(84, 'treble')).toEqual([10, 12]); // C6 上加二线
    expect(ledgerLinesOf(84, 'bass')).toEqual([10, 12]);   // C6 在低音谱上方同样两条
  });

  it('layoutStaffNote 返回 step 与加线', () => {
    expect(layoutStaffNote(81, 'treble')).toEqual({ step: 10, ledgerLines: [10] });
  });
});
```

> 验算：高音谱五线自下而上 E4 G4 B4 D5 F5（步 0,2,4,6,8），低音谱 G2 B2 D3 F3 A3。相邻字母在谱上差 1 步（线→间→线），所以每个谱表步 = 1 个字母位；越界的**偶数步**（线位）画加线，**奇数步**（空间）不画。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/notation/positions.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现 positions.ts**

`src/core/notation/positions.ts`：

```ts
// 五线位置数学：把 MIDI 音高换算成"谱表步"。
// 相邻线/间各差 1 步；五线位置在偶数步 0,2,4,6,8，间在奇数步。step 0 = 谱表底线。

import { nameToMidi, letterIndex, midiToPc } from './note';

export type Clef = 'treble' | 'bass';

export const CLEF_BOTTOM_LINE: Record<Clef, string> = {
  treble: 'E4',
  bass: 'G2',
};

export interface StaffNoteLayout {
  /** 音符头中心的谱表步（偶=线，奇=间） */
  step: number;
  /** 需绘制的加线 step 列表（越界的线位步）。空间音符无加线。 */
  ledgerLines: number[];
}

/** midi → 全音阶序号（每字母 +1，跨八度 +7）。仅对自然音精确。 */
function diatonicOfMidi(midi: number): number {
  const octave = Math.floor(midi / 12) - 1;
  const letter = midiToPc(midi)[0]; // 自然音取字母
  return octave * 7 + letterIndex(letter);
}

/** 音符相对谱表底线的谱表步 */
export function staffStep(midi: number, clef: Clef): number {
  const bottom = nameToMidi(CLEF_BOTTOM_LINE[clef])!;
  return diatonicOfMidi(midi) - diatonicOfMidi(bottom);
}

/** 越界音符的加线：只在线位步（偶数）出现 */
export function ledgerLinesOf(midi: number, clef: Clef): number[] {
  const step = staffStep(midi, clef);
  const out: number[] = [];
  if (step > 8) {
    for (let s = 10; s <= step; s += 2) out.push(s);
  } else if (step < 0) {
    for (let s = -2; s >= step; s -= 2) out.push(s);
  }
  return out;
}

/** 布局：给渲染层一次性提供 step 与加线 */
export function layoutStaffNote(midi: number, clef: Clef): StaffNoteLayout {
  return { step: staffStep(midi, clef), ledgerLines: ledgerLinesOf(midi, clef) };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/notation/positions.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/core/notation
git commit -m "feat(sightflash): 五线位置数学 positions.ts"
```

---

### Task 4: 出题引擎（难度阶梯 + 加权抽样 + 题=音+谱）

**Files:**
- Create: `src/core/generator/stages.ts`
- Create: `src/core/generator/generator.ts`
- Test: `src/core/generator/generator.test.ts`

- [ ] **Step 1: 写失败测试**

`src/core/generator/generator.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, pickWeighted, chooseMidi, chooseQuestion } from './generator';
import { poolForStage, MAX_STAGE, clefUnlockStage } from './stages';

describe('stages 难度阶梯', () => {
  it('阶段递增时高音池只增不减', () => {
    for (let s = 1; s < MAX_STAGE; s++) {
      expect(poolForStage(s + 1, 'treble').length).toBeGreaterThan(poolForStage(s, 'treble').length);
    }
  });

  it('低音 S2 解锁、混合 S3 解锁', () => {
    expect(clefUnlockStage('treble')).toBe(1);
    expect(clefUnlockStage('bass')).toBe(2);
    expect(clefUnlockStage('mixed')).toBe(3);
  });

  it('混合池 = 高音 + 低音并集', () => {
    const mixed = poolForStage(3, 'mixed');
    expect(mixed).toContain(64); // 高音(E4)
    expect(mixed).toContain(57); // 低音(A3)
  });

  it('全池只含自然音', () => {
    for (const clef of ['treble', 'bass'] as const) {
      for (let s = 1; s <= MAX_STAGE; s++) {
        for (const m of poolForStage(s, clef)) {
          expect([0, 2, 4, 5, 7, 9, 11]).toContain(m % 12);
        }
      }
    }
  });
});

describe('generator 出题', () => {
  it('mulberry32 固定种子产出确定序列', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBe(r2());
  });

  it('pickWeighted 依权重选中', () => {
    const rng = mulberry32(7);
    expect(pickWeighted(rng, ['a', 'b', 'c'], [1, 90, 1])).toBe('b');
  });

  it('chooseMidi 落在池内且相邻不重复（池>1）', () => {
    const rng = mulberry32(123);
    const pool = poolForStage(3, 'treble');
    let prev = pool[0];
    for (let i = 0; i < 50; i++) {
      const m = chooseMidi(rng, 3, 'treble', {}, prev);
      expect(pool).toContain(m);
      expect(m).not.toBe(prev);
      prev = m;
    }
  });

  it('chooseQuestion 返回 midi+clef，混合时两谱都会出现', () => {
    const rng = mulberry32(5);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const q = chooseQuestion(rng, 5, 'mixed', {}, -1);
      expect(poolForStage(5, q.clef)).toContain(q.midi);
      seen.add(q.clef);
    }
    expect(seen.has('treble')).toBe(true);
    expect(seen.has('bass')).toBe(true);
  });

  it('错音加权：错得多的音被抽中次数显著上升', () => {
    const pool = poolForStage(5, 'treble');
    const target = pool[0];
    const rng = mulberry32(9);
    let hit = 0;
    for (let i = 0; i < 2000; i++) {
      if (chooseMidi(rng, 5, 'treble', { [target]: 5 }, -1) === target) hit++;
    }
    expect(hit).toBeGreaterThan(400); // 加权 1+min(5,3)=4/15 ≈ 27%，2000 次约 530
    expect(hit).toBeLessThan(900);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/generator/generator.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现 stages.ts**

`src/core/generator/stages.ts`：

```ts
import type { Clef } from '../notation/positions';

export type MixedClef = Clef | 'mixed';

export const MAX_STAGE = 5;

// 默认参数（可调）。高音谱以 C4 为锚向上、低音谱以 C4 为锚向下（含加线）。
// 只含自然音：BASS_DOWN 依次 C4 B3 A3 G3 F3 E3 D3 C3 B2 A2 G2。
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

/** 某谱号在某阶段的可用音符池 */
export function poolForStage(stage: number, clef: MixedClef): number[] {
  const s = Math.max(1, Math.min(MAX_STAGE, stage));
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

- [ ] **Step 4: 实现 generator.ts**

`src/core/generator/generator.ts`：

```ts
import type { Clef } from '../notation/positions';
import type { MixedClef } from './stages';
import { poolForStage } from './stages';

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

/** 在单谱池内抽一个音。wrong[midi] 越高权重越大；相邻不重复（最多重抽 5 次）。 */
export function chooseMidi(
  rng: () => number,
  stage: number,
  clef: MixedClef,
  wrong: Record<number, number>,
  prev: number,
): number {
  const pool = poolForStage(stage, clef);
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
}

/**
 * 出下一题。选择谱号：clef='mixed' 时每道题 50/50 掷高音/低音谱；
 * 其余用指定谱。再在对应池内抽音（prev 为上一题的 midi，避免相邻同音）。
 */
export function chooseQuestion(
  rng: () => number,
  stage: number,
  clef: MixedClef,
  wrong: Record<number, number>,
  prev: number,
): Question {
  const sub: Clef = clef === 'mixed' ? (rng() < 0.5 ? 'treble' : 'bass') : clef;
  const midi = chooseMidi(rng, stage, sub, wrong, prev);
  return { midi, clef: sub };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/core/generator/generator.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/core/generator
git commit -m "feat(sightflash): 出题引擎（阶梯+加权抽样+题=音+谱）"
```

---

### Task 5: 结算统计 compute-result（速度/准确率）

**Files:**
- Create: `src/core/result.ts`
- Test: `src/core/result.test.ts`

- [ ] **Step 1: 写失败测试**

`src/core/result.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { computeResult, shouldAdvanceStage } from './result';

describe('result 结算', () => {
  it('正确 40 音 / 60 秒 → 速度 40 音/分、准确率 80%', () => {
    const r = computeResult(40, 50, 60);
    expect(r.speed).toBe(40);
    expect(r.accuracy).toBe(80);
  });

  it('空轮次不除零', () => {
    const r = computeResult(0, 0, 60);
    expect(r.speed).toBe(0);
    expect(r.accuracy).toBe(0);
  });

  it('时长 0 秒时速度为 0', () => {
    const r = computeResult(10, 10, 0);
    expect(r.speed).toBe(0);
  });

  it('升阶门槛：准确率 ≥85 达标', () => {
    expect(shouldAdvanceStage({ accuracy: 90 })).toBe(true);
    expect(shouldAdvanceStage({ accuracy: 85 })).toBe(true);
    expect(shouldAdvanceStage({ accuracy: 84 })).toBe(false);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/result.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 result.ts**

`src/core/result.ts`：

```ts
export interface ResultSummary {
  correct: number;
  total: number;
  durationSec: number;
  /** 每分钟正确数，保留 1 位 */
  speed: number;
  /** 准确率百分比（整数） */
  accuracy: number;
}

export function computeResult(correct: number, total: number, durationSec: number): ResultSummary {
  const speed = durationSec > 0 ? Math.round((correct / (durationSec / 60)) * 10) / 10 : 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, durationSec, speed, accuracy };
}

/** 达标即升阶（门槛：准确率 ≥85） */
export function shouldAdvanceStage(r: { accuracy: number }): boolean {
  return r.accuracy >= 85;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/core/result.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/core/result.ts sightflash/src/core/result.test.ts
git commit -m "feat(sightflash): 结算统计 computeResult"
```

---

### Task 6: 存储层（状态模型 + MemoryRepo + 打卡/错音纯逻辑）

**Files:**
- Create: `src/core/storage/types.ts`
- Create: `src/core/storage/logic.ts`
- Create: `src/core/storage/memory.ts`
- Test: `src/core/storage/logic.test.ts`
- Test: `src/core/storage/memory.test.ts`

- [ ] **Step 1: 写失败测试（logic）**

`src/core/storage/logic.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { defaultState, makeDay, applyStreak, applyDaily, registerMistake, registerCorrect } from './logic';

describe('storage logic 状态机', () => {
  it('defaultState 从 S1 开始且无错音', () => {
    const s = defaultState();
    expect(s.progress.stage).toBe(1);
    expect(s.progress.wrong).toEqual({});
  });

  it('streak：连续日期递增，断签重置，同日幂等', () => {
    expect(applyStreak({ current: 0, lastDate: '' }, '2026-09-05')).toEqual({ current: 1, lastDate: '2026-09-05' });
    expect(applyStreak({ current: 3, lastDate: '2026-09-04' }, '2026-09-05')).toEqual({ current: 4, lastDate: '2026-09-05' });
    expect(applyStreak({ current: 4, lastDate: '2026-09-05' }, '2026-09-05')).toEqual({ current: 4, lastDate: '2026-09-05' });
    expect(applyStreak({ current: 3, lastDate: '2026-09-02' }, '2026-09-05')).toEqual({ current: 1, lastDate: '2026-09-05' });
  });

  it('daily 只累计当日，跨天清零', () => {
    expect(applyDaily({ date: '2026-09-05', correct: 10 }, '2026-09-05', 5)).toEqual({ date: '2026-09-05', correct: 15 });
    expect(applyDaily({ date: '2026-09-04', correct: 10 }, '2026-09-05', 5)).toEqual({ date: '2026-09-05', correct: 5 });
  });

  it('错音累计与正确抵消（至 0 删除）', () => {
    let p = defaultState().progress;
    p = registerMistake(p, 60);
    p = registerMistake(p, 60);
    expect(p.wrong[60]).toBe(2);
    p = registerCorrect(p, 60);
    p = registerCorrect(p, 60);
    expect(p.wrong[60]).toBeUndefined();
  });

  it('makeDay 输出本地 YYYY-MM-DD', () => {
    expect(makeDay(new Date(2026, 8, 5, 12))).toBe('2026-09-05');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/storage/logic.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 types.ts**

`src/core/storage/types.ts`：

```ts
import type { MixedClef } from '../generator/stages';

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
}

export interface Streak {
  current: number;
  lastDate: string; // YYYY-MM-DD
}

export interface Daily {
  date: string;
  correct: number;
}

export interface AppState {
  progress: Progress;
  settings: Settings;
  streak: Streak;
  daily: Daily;
}

export interface SessionRecord {
  id?: number;
  ts: number;
  mode: Mode;
  clef: MixedClef;
  stage: number;
  correct: number;
  total: number;
  durationSec: number;
  speed: number;
  accuracy: number;
}
```

- [ ] **Step 4: 实现 logic.ts**

`src/core/storage/logic.ts`：

```ts
import type { AppState, Progress, Streak, Daily } from './types';

export const DAILY_GOAL = 100;

export function defaultState(): AppState {
  return {
    progress: { stage: 1, wrong: {} },
    settings: { sound: true, durationSec: 60, lastMode: 'tap', lastClef: 'treble' },
    streak: { current: 0, lastDate: '' },
    daily: { date: '', correct: 0 },
  };
}

/** 本地日期 → "YYYY-MM-DD" */
export function makeDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 打卡：昨天连上则 +1，断签从 1 重计，同日幂等 */
export function applyStreak(streak: Streak, today: string): Streak {
  if (streak.lastDate === today) return streak;
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const yDay = makeDay(d);
  if (streak.lastDate === yDay) return { current: streak.current + 1, lastDate: today };
  return { current: 1, lastDate: today };
}

/** 每日正确数累计（跨天清零） */
export function applyDaily(daily: Daily, today: string, add: number): Daily {
  if (daily.date === today) return { ...daily, correct: daily.correct + add };
  return { date: today, correct: add };
}

/** 答错：该音错计数 +1（返回新对象） */
export function registerMistake(p: Progress, midi: number): Progress {
  return { ...p, wrong: { ...p.wrong, [midi]: (p.wrong[midi] ?? 0) + 1 } };
}

/** 答对：若该音有错计数则扣 1，至 0 删除 */
export function registerCorrect(p: Progress, midi: number): Progress {
  if (!p.wrong[midi]) return p;
  const next = { ...p.wrong, [midi]: p.wrong[midi] - 1 };
  if (next[midi] <= 0) delete next[midi];
  return { ...p, wrong: next };
}
```

- [ ] **Step 5: 写失败测试（memory）**

`src/core/storage/memory.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { MemoryRepo } from './memory';
import { defaultState } from './logic';

describe('MemoryRepo', () => {
  it('保存后能读回', async () => {
    const repo = new MemoryRepo(defaultState());
    const s = await repo.loadState();
    s.progress.stage = 3;
    await repo.saveState(s);
    expect((await repo.loadState()).progress.stage).toBe(3);
  });

  it('addSession 返回自增 id 且可列举', async () => {
    const repo = new MemoryRepo(defaultState());
    const id = await repo.addSession({
      ts: 1, mode: 'tap', clef: 'treble', stage: 1,
      correct: 10, total: 12, durationSec: 60, speed: 10, accuracy: 83,
    });
    expect(id).toBe(1);
    expect((await repo.listSessions()).length).toBe(1);
  });
});
```

- [ ] **Step 6: 实现 memory.ts**

`src/core/storage/memory.ts`：

```ts
import type { AppState, SessionRecord } from './types';

/** 仓储接口：里程碑 B（云同步/降级）复用同一接口 */
export interface SightRepo {
  loadState(): Promise<AppState>;
  saveState(s: AppState): Promise<void>;
  addSession(s: SessionRecord): Promise<number>;
  listSessions(): Promise<SessionRecord[]>;
  clearAll(): Promise<void>;
}

/** 内存实现：供测试与浏览器无 IndexedDB 时降级 */
export class MemoryRepo implements SightRepo {
  private state: AppState;
  private sessions: SessionRecord[] = [];
  private seq = 1;

  constructor(initial: AppState) {
    this.state = structuredClone(initial);
  }

  async loadState(): Promise<AppState> {
    return structuredClone(this.state);
  }
  async saveState(s: AppState): Promise<void> {
    this.state = structuredClone(s);
  }
  async addSession(s: SessionRecord): Promise<number> {
    const rec = { ...structuredClone(s), id: this.seq++ };
    this.sessions.push(rec);
    return rec.id as number;
  }
  async listSessions(): Promise<SessionRecord[]> {
    return this.sessions.map((s) => structuredClone(s));
  }
  async clearAll(): Promise<void> {
    this.sessions = [];
  }
}
```

- [ ] **Step 7: 运行全部存储测试确认通过**

Run: `npx vitest run src/core/storage`
Expected: PASS（logic + memory）。

- [ ] **Step 8: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/core/storage
git commit -m "feat(sightflash): 状态模型 + MemoryRepo + 打卡/错音纯逻辑"
```

---

### Task 7: 统计聚合 stats.ts

**Files:**
- Create: `src/core/stats.ts`
- Test: `src/core/stats.test.ts`

- [ ] **Step 1: 写失败测试**

`src/core/stats.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { speedTrend, latestAccuracies, errorDistribution } from './stats';
import type { SessionRecord } from './storage/types';

const mk = (ts: number, speed: number, accuracy: number): SessionRecord =>
  ({ ts, mode: 'tap', clef: 'treble', stage: 1, correct: 10, total: 12, durationSec: 60, speed, accuracy });

describe('stats', () => {
  it('speedTrend 按 ts 升序', () => {
    const t = speedTrend([mk(3, 30, 80), mk(1, 20, 80), mk(2, 25, 80)]);
    expect(t.map((p) => p.value)).toEqual([20, 25, 30]);
  });

  it('latestAccuracies 取最近 20 次', () => {
    const many = Array.from({ length: 25 }, (_, i) => mk(i, 10, i));
    const a = latestAccuracies(many);
    expect(a.length).toBe(20);
    expect(a[0]).toBe(5);
  });

  it('errorDistribution 降序返回', () => {
    const dist = errorDistribution({ 60: 5, 64: 9, 67: 1 });
    expect(dist[0]).toEqual({ midi: 64, count: 9 });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/stats.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 stats.ts**

`src/core/stats.ts`：

```ts
import type { SessionRecord } from './storage/types';

export interface Point {
  ts: number;
  value: number;
}

/** 每次练习的速度（按时间升序） */
export function speedTrend(sessions: SessionRecord[]): Point[] {
  return [...sessions]
    .sort((a, b) => a.ts - b.ts)
    .map((s) => ({ ts: s.ts, value: s.speed }));
}

/** 最近 20 次准确率（时间升序） */
export function latestAccuracies(sessions: SessionRecord[]): number[] {
  return [...sessions]
    .sort((a, b) => a.ts - b.ts)
    .slice(-20)
    .map((s) => s.accuracy);
}

/** 错音分布：降序 */
export function errorDistribution(wrong: Record<number, number>): Array<{ midi: number; count: number }> {
  return Object.entries(wrong)
    .map(([midi, count]) => ({ midi: Number(midi), count }))
    .sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/core/stats.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/core/stats.ts sightflash/src/core/stats.test.ts
git commit -m "feat(sightflash): 统计聚合 stats"
```

---

### Task 8: 应用壳 + IndexedDB 仓储 + 全局状态 + 首页

**Files:**
- Create: `src/app/indexeddb.ts`
- Create: `src/app/state.tsx`
- Create: `src/app/App.tsx`
- Create: `src/ui/HomeScreen.tsx`
- Create: `src/ui/NoteButton.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: 写失败测试（冒烟）**

`src/app/App.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppRoot } from './App';

describe('AppRoot', () => {
  it('加载后首页出现“五线速读”', async () => {
    render(<AppRoot repoKind="memory" />);
    expect(await screen.findByText(/五线速读/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/app/App.test.tsx`
Expected: FAIL —— AppRoot 不存在。

- [ ] **Step 3: 实现 indexeddb.ts**

`src/app/indexeddb.ts`：

```ts
import { openDB, type DBSchema } from 'idb';
import type { AppState, SessionRecord } from '../core/storage/types';
import type { SightRepo } from '../core/storage/memory';
import { defaultState } from '../core/storage/logic';

interface SightDB extends DBSchema {
  kv: { key: string; value: AppState };
  sessions: { key: number; value: SessionRecord; autoIncrement: true };
}

let dbPromise: ReturnType<typeof openDB<SightDB>> | null = null;
function db() {
  if (!dbPromise) {
    dbPromise = openDB<SightDB>('sightflash', 1, {
      upgrade(d) {
        d.createObjectStore('kv');
        d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

export const KV_STATE = 'state';

/** 默认状态（统一走 core/storage/logic 的 defaultState） */
export { defaultState as initialState };

/** IndexedDB 仓储（真实运行环境） */
export class IdbRepo implements SightRepo {
  async loadState(): Promise<AppState> {
    const s = await (await db()).get('kv', KV_STATE);
    return s ?? defaultState();
  }
  async saveState(s: AppState): Promise<void> {
    await (await db()).put('kv', s, KV_STATE);
  }
  async addSession(s: SessionRecord): Promise<number> {
    return (await db()).add('sessions', s);
  }
  async listSessions(): Promise<SessionRecord[]> {
    return (await db()).getAll('sessions');
  }
  async clearAll(): Promise<void> {
    const d = await db();
    await d.clear('kv');
    await d.clear('sessions');
  }
}
```

- [ ] **Step 4: 实现 state.tsx（仓储装配 + 全局状态 + 视图）**

`src/app/state.tsx`：

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState } from '../core/storage/types';
import type { SightRepo } from '../core/storage/memory';
import { MemoryRepo } from '../core/storage/memory';
import { IdbRepo, initialState } from './indexeddb';

export type View = 'home' | 'setup' | 'practice' | 'result' | 'stats' | 'settings';

export interface AppStore {
  repo: SightRepo;
  state: AppState;
  view: View;
  go: (v: View) => void;
  setState: (updater: (prev: AppState) => AppState) => void;
  ready: boolean;
}

const Ctx = createContext<AppStore | null>(null);

export function useApp(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

/** repoKind 供测试注入内存实现；真实运行走 IndexedDB，不可用时内存兜底 */
export function makeRepo(repoKind?: 'memory' | 'auto'): SightRepo {
  if (repoKind === 'memory') return new MemoryRepo(initialState());
  try {
    if (typeof indexedDB !== 'undefined') return new IdbRepo();
  } catch { /* ignore */ }
  return new MemoryRepo(initialState());
}

export function AppProvider({ repoKind, children }: { repoKind?: 'memory' | 'auto'; children: ReactNode }) {
  const repo = useMemo(() => makeRepo(repoKind), [repoKind]);
  const [state, setState] = useState<AppState>(initialState());
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('home');

  // 首次载入
  useEffect(() => {
    let alive = true;
    repo.loadState().then((s) => {
      if (!alive) return;
      setState(s);
      setReady(true);
    });
    return () => { alive = false; };
  }, [repo]);

  // 状态变更即持久化（本 App 数据量小，直接全量保存；ready 前不写以免覆盖载入）
  useEffect(() => {
    if (!ready) return;
    void repo.saveState(state);
  }, [repo, state, ready]);

  const store: AppStore = useMemo(
    () => ({ repo, state, view, go: setView, setState, ready }),
    [repo, state, view, ready],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 5: 实现 App.tsx**

`src/app/App.tsx`：

```tsx
import { AppProvider, useApp } from './state';
import { HomeScreen } from '../ui/HomeScreen';

export function AppRoot({ repoKind }: { repoKind?: 'memory' | 'auto' }) {
  return (
    <AppProvider repoKind={repoKind}>
      <Shell />
    </AppProvider>
  );
}

/** 各视图占位：Task 10/11 逐个替换为真实屏幕 */
function Shell() {
  const { ready, view } = useApp();
  if (!ready) return <div className="boot">载入中…</div>;
  switch (view) {
    case 'practice': return <div className="boot">练习视图（Task 10 接入）</div>;
    case 'result': return <div className="boot">结算视图（Task 10 接入）</div>;
    case 'setup': return <div className="boot">开始设置（Task 11 接入）</div>;
    case 'stats': return <div className="boot">数据视图（Task 11 接入）</div>;
    case 'settings': return <div className="boot">设置（Task 11 接入）</div>;
    case 'home':
    default: return <HomeScreen />;
  }
}
```

- [ ] **Step 6: 实现 HomeScreen.tsx 与 NoteButton.tsx**

`src/ui/HomeScreen.tsx`：

```tsx
import { useApp } from '../app/state';
import { makeDay, DAILY_GOAL } from '../core/storage/logic';

export function HomeScreen() {
  const { state, go } = useApp();
  const done = state.daily.date === makeDay(new Date()) ? state.daily.correct : 0;
  const pct = Math.min(100, Math.round((done / DAILY_GOAL) * 100));
  return (
    <main className="screen home">
      <h1>🎼 五线速读</h1>
      <button className="big primary" onClick={() => go('setup')}>开始训练</button>
      <div className="card">🔥 连续 {state.streak.current} 天 · 阶段 S{state.progress.stage}</div>
      <div className="card">
        <div>今日目标：{done}/{DAILY_GOAL} 音</div>
        <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="row">
        <button className="ghost" onClick={() => go('stats')}>📊 数据</button>
        <button className="ghost" onClick={() => go('settings')}>⚙️ 设置</button>
      </div>
    </main>
  );
}
```

`src/ui/NoteButton.tsx`：

```tsx
export function NoteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="note-btn" onClick={onClick}>
      {label}
    </button>
  );
}
```

- [ ] **Step 7: 覆盖 src/index.css**

`src/index.css`（全文）：

```css
* { box-sizing: border-box; }
html, body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
#root { max-width: 640px; margin: 0 auto; min-height: 100dvh; }
.screen { padding: 16px; }
h1 { font-size: 1.6rem; margin: 4px 0 12px; }
.card { background: #1e293b; border-radius: 12px; padding: 16px; margin: 12px 0; }
.boot { padding: 40px; text-align: center; color: #94a3b8; }
.bar { height: 8px; background: #334155; border-radius: 4px; overflow: hidden; margin: 8px 0; }
.bar-fill { height: 100%; background: #38bdf8; transition: width .3s; }
.row { display: flex; gap: 8px; justify-content: center; align-items: center; }
.row.space-between { justify-content: space-between; }
button { font: inherit; }
button.primary { background: #38bdf8; color: #0f172a; border: 0; border-radius: 10px; padding: 12px 20px; font-size: 1.1rem; }
button.big { width: 100%; padding: 16px; font-size: 1.2rem; margin: 8px 0; }
button.sel, button.ghost, button.danger { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 10px; padding: 10px 14px; margin: 6px; }
button.sel:disabled { opacity: .4; }
button.sel.small { padding: 6px 12px; }
button.danger { color: #fca5a5; border-color: #7f1d1d; }
.note-btn { flex: 1; min-width: 0; aspect-ratio: 1; font-size: 1.35rem; border-radius: 12px; border: 1px solid #334155; background: #1e293b; color: #e2e8f0; }
.label { color: #94a3b8; margin-bottom: 6px; }
.small { color: #64748b; font-size: .85rem; }
.timer { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
.timer.warn { color: #f87171; }
.fb { min-height: 28px; text-align: center; font-size: 1.1rem; margin: 8px 0; }
.fb.ok { color: #4ade80; }
.fb.bad { color: #f87171; }
.staff-wrap { text-align: center; margin: 4px 0; }
.chart { width: 100%; height: 100px; background: #0b1220; border-radius: 8px; }
.err-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.err-row .bar { flex: 1; margin: 0; }
.bar-fill.warn { background: #f87171; }
.danger { margin-top: 16px; }
```

- [ ] **Step 8: 运行测试 + 类型检查**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run src/app/App.test.tsx
npx tsc -b # 类型门禁：根 tsconfig 为 references 方案，单独跑 --noEmit 是空操作，须用 -b
```
Expected: 测试 PASS；tsc 无错。

- [ ] **Step 9: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/app sightflash/src/ui sightflash/src/index.css
git commit -m "feat(sightflash): 应用壳 + IndexedDB 仓储 + 全局状态 + 首页"
```

---

### Task 9: 五线谱渲染组件 StaffView（SVG）

**Files:**
- Create: `src/ui/StaffView.tsx`
- Test: `src/ui/StaffView.test.tsx`

- [ ] **Step 1: 写失败测试**

`src/ui/StaffView.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaffView } from './StaffView';

describe('StaffView', () => {
  it('渲染 5 条线与谱号与音符头', () => {
    render(<StaffView midi={67} clef="treble" />); // G4 在第 2 线，无需加线
    expect(document.querySelectorAll('line.staff-line')).toHaveLength(5);
    expect(screen.getByTestId('clef')).toBeInTheDocument();
    expect(document.querySelector('ellipse.note-head')).not.toBeNull();
  });

  it('C4 在低音谱需要上加一线（出现 1 条加线）', () => {
    render(<StaffView midi={60} clef="bass" />);
    expect(document.querySelectorAll('line.ledger')).toHaveLength(1);
  });

  it('垂直方向正确：低音在下、高音在上（y 坐标单调）', () => {
    const low = render(<StaffView midi={60} clef="treble" />); // C4 在底线下方（下加一线）
    const high = render(<StaffView midi={77} clef="treble" />); // F5 顶线
    const y = (el: HTMLElement) =>
      Number(el.querySelector('ellipse.note-head')!.getAttribute('cy'));
    expect(y(low.container)).toBeGreaterThan(y(high.container));
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/ui/StaffView.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 StaffView.tsx**

`src/ui/StaffView.tsx`：

```tsx
import { layoutStaffNote } from '../core/notation/positions';
import type { Clef } from '../core/notation/positions';

const SPACE = 16; // px / 谱表步
const VIEW_STEPS = 17; // viewBox 高 = 17 步 = 272px
const ANCHOR_STEP = 13; // y=0（顶边）对应的谱表步；step 越往下越小
const SVG_W = 320;
const LINES = [0, 2, 4, 6, 8]; // 五条线自下而上：步 0 底线(E4/G2) ~ 步 8 顶线(F5/A3)
const clefGlyph: Record<Clef, string> = { treble: '𝄞', bass: '𝄢' };

// SVG y 向下增长；谱表步越大音越高、画得越靠上，故 y 越小。
const stepToY = (s: number) => (ANCHOR_STEP - s) * SPACE;

export function StaffView({ midi, clef }: { midi: number; clef: Clef }) {
  const { step, ledgerLines } = layoutStaffNote(midi, clef);
  const H = VIEW_STEPS * SPACE;
  const cy = stepToY(step);
  return (
    <div className="staff-wrap">
      <svg data-testid="staff" viewBox={`0 0 ${SVG_W} ${H}`} style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }}>
        {/* 谱号：基线为近似值（依赖系统字形度量），Task 12 真机核对 */}
        <text data-testid="clef" x={14} y={stepToY(clef === 'treble' ? 2 : 0) + 6} fontSize={52}
          fill="#cbd5e1" fontFamily="'Noto Music','Segoe UI Symbol',serif">
          {clefGlyph[clef]}
        </text>
        {LINES.map((l) => (
          <line key={l} className="staff-line" x1={60} x2={SVG_W - 16} y1={stepToY(l)} y2={stepToY(l)}
            stroke="#64748b" strokeWidth={1.5} />
        ))}
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

> y 方向：SVG y 向下增长，谱表步 s 越大（音越高）应画得越靠上，故 `stepToY(s) = (ANCHOR_STEP − s)·SPACE`。step0（底线 E4/G2）在 y=13·16=208，位于谱表下缘；step8（顶线 F5/A3）在 y=80。可见 s ∈ [−4, 13]：treble C4(−2) 画在底线下方（下加线），treble C6(12) 画在顶线上方（上加二线）。低音 C4 的加线是"上加一线"、应画在顶线之上。本组件几何由 Task 3 单测保证，谱号基线为近似值，视觉精确性由 Task 12 真机清单核对。
> 谱号字形 𝄞/𝄢 依赖系统音乐字体（安卓 Chrome 通常有 Noto Music）；若真机缺字形，里程碑 B 收尾再换内嵌 SVG 路径——记为已知待办，不进本计划。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/ui/StaffView.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/ui/StaffView.tsx sightflash/src/ui/StaffView.test.tsx
git commit -m "feat(sightflash): 五线谱 SVG 渲染组件"
```

---

### Task 10: 会话状态机 + 认音练习 + 结算

**Files:**
- Create: `src/core/session.ts`
- Test: `src/core/session.test.ts`
- Create: `src/ui/PracticeScreen.tsx`
- Create: `src/ui/ResultScreen.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: 写失败测试（会话状态机）**

`src/core/session.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { createSession, answerTap, computeWrongDeltas } from './session';
import { mulberry32 } from './generator/generator';
import { LETTER_PC } from './notation/note';

const pc = (letter: string) => LETTER_PC[letter]; // C→0 …

describe('session 会话状态机', () => {
  it('答对（音级匹配）：计数+1 并换下一题', () => {
    const s = createSession({ stage: 1, clef: 'treble', durationSec: 60, rng: mulberry32(1), wrong: {} });
    const t = s.target.midi;
    const next = answerTap(s, t % 12);
    expect(next.correct).toBe(1);
    expect(next.total).toBe(1);
    expect(next.history[0].result).toBe('correct');
  });

  it('答错：total+1、错音记入、题目停留', () => {
    const s = createSession({ stage: 1, clef: 'treble', durationSec: 60, rng: mulberry32(2), wrong: {} });
    const targetMidi = s.target.midi;
    const correctPc = targetMidi % 12;
    const wrongPc = correctPc === pc('C') ? pc('D') : pc('C'); // 保证答错
    const next = answerTap(s, wrongPc);
    expect(next.correct).toBe(0);
    expect(next.total).toBe(1);
    expect(next.target.midi).toBe(targetMidi); // 停留
    expect(next.history[0]).toMatchObject({ result: 'wrong', expectedMidi: targetMidi });
  });

  it('混合模式每道题携带明确的 clef', () => {
    const s = createSession({ stage: 5, clef: 'mixed', durationSec: 60, rng: mulberry32(3), wrong: {} });
    expect(['treble', 'bass']).toContain(s.target.clef);
  });

  it('computeWrongDeltas：从未答对的音入池，最终答对的音出池', () => {
    // 人为构造 history：C4 全错（停留未解决），G4 错后对（解决）
    const base = { result: 'wrong' as const, expectedMidi: 60, expectedPc: 0, actualPc: 2 };
    const hist = [
      { result: 'correct' as const, expectedMidi: 67, expectedPc: 7, actualPc: 7 },
      { ...base, result: 'wrong' as const },
      { result: 'correct' as const, expectedMidi: 60, expectedPc: 0, actualPc: 0 },
      { ...base },
    ];
    const d = computeWrongDeltas(hist);
    expect(d.toLearn).toEqual([60]); // C4 仍错误未解决 → 加深
    expect(d.recalled).toEqual([60, 67]); // C4/G4 本轮有答对 → 出池
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/session.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 session.ts**

`src/core/session.ts`：

```ts
import type { MixedClef } from './generator/stages';
import { chooseQuestion } from './generator/generator';
import type { Question } from './generator/generator';

export type ResultKind = 'correct' | 'wrong';

export interface HistoryItem {
  result: ResultKind;
  /** 目标音 MIDI（画在谱上的具体八度，用于错音登记） */
  expectedMidi: number;
  /** 目标音级（0-11） */
  expectedPc: number;
  /** 作答音级（0-11） */
  actualPc: number;
}

export interface SessionConfig {
  stage: number;
  clef: MixedClef;
  durationSec: number;
  rng: () => number;
  wrong: Record<number, number>;
}

export interface Session {
  stage: number;
  clef: MixedClef;
  durationSec: number;
  rng: () => number;
  wrong: Record<number, number>;
  target: Question;
  correct: number;
  total: number;
  history: HistoryItem[];
  last: HistoryItem | null;
}

export function createSession(c: SessionConfig): Session {
  const target = chooseQuestion(c.rng, c.stage, c.clef, c.wrong, -1);
  return { ...c, target, correct: 0, total: 0, history: [], last: null };
}

/**
 * 认音作答（pure）：按音级判定（同一字母不同八度都算对）。
 * 对则推进到下一题；错则题目停留便于马上重试，但记录进 history。
 */
export function answerTap(s: Session, guessedPc: number): Session {
  const expectedPc = s.target.midi % 12;
  const ok = guessedPc % 12 === expectedPc;
  const item: HistoryItem = {
    result: ok ? 'correct' : 'wrong',
    expectedMidi: s.target.midi,
    expectedPc,
    actualPc: guessedPc % 12,
  };
  const history = [item, ...s.history];
  const target = ok ? chooseQuestion(s.rng, s.stage, s.clef, s.wrong, s.target.midi) : s.target;
  return { ...s, target, correct: s.correct + (ok ? 1 : 0), total: s.total + 1, history, last: item };
}

export interface WrongDeltas {
  /** 本轮仍未解决的错音 MIDI：需 registerMistake（加深） */
  toLearn: number[];
  /** 本轮至少答对过一次的 MIDI：需 registerCorrect（若先前有错则扣减） */
  recalled: number[];
}

/**
 * 从一局 history 归纳错音增删（history[0] 为最新，answerTap 前插）。
 * recalled：本轮至少答对过 1 次的音（若先前有错计数则 registerCorrect 扣减）；
 * toLearn：本轮结束仍停在错的音（该音最新一次作答仍 wrong，即使中途对过）→ registerMistake 加深。
 * 两集合可重叠（PracticeScreen 先加深后扣减）。按 MIDI 升序输出，保证确定性。
 */
export function computeWrongDeltas(history: HistoryItem[]): WrongDeltas {
  const recalled = new Set<number>();
  const last = new Map<number, ResultKind>(); // 每音最新一次作答（首个遇到的即最新）
  for (const h of history) {
    if (h.result === 'correct') recalled.add(h.expectedMidi);
    if (!last.has(h.expectedMidi)) last.set(h.expectedMidi, h.result);
  }
  const sort = (a: number, b: number) => a - b;
  return {
    toLearn: [...last.entries()].filter(([, r]) => r === 'wrong').map(([m]) => m).sort(sort),
    recalled: [...recalled].sort(sort),
  };
}
```

- [ ] **Step 4: 运行 session 测试确认通过**

Run: `npx vitest run src/core/session.test.ts`
Expected: PASS。

- [ ] **Step 5: 实现 PracticeScreen.tsx**

`src/ui/PracticeScreen.tsx`：

```tsx
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { createSession, answerTap, computeWrongDeltas } from '../core/session';
import { mulberry32 } from '../core/generator/generator';
import { MAX_STAGE } from '../core/generator/stages';
import { computeResult, shouldAdvanceStage } from '../core/result';
import { makeDay, applyStreak, applyDaily, registerMistake, registerCorrect } from '../core/storage/logic';
import { midiToName } from '../core/notation/note';
import { StaffView } from './StaffView';
import { NoteButton } from './NoteButton';

const PITCH_BUTTONS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const BUTTON_PC: Record<(typeof PITCH_BUTTONS)[number], number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

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

  // 时间到 → 结算 → 落库（setState 触发 state.tsx 持久化）
  useEffect(() => {
    if (left > 0 || finished.current) return;
    finished.current = true;
    const r = computeResult(sess.correct, sess.total, cfg.durationSec);
    const now = new Date();
    const today = makeDay(now);

    // 错音池增量：未解决音加深，有答对的音出池
    const { toLearn, recalled } = computeWrongDeltas(sess.history);
    let progress = state.progress;
    for (const m of toLearn) progress = registerMistake(progress, m);
    for (const m of recalled) progress = registerCorrect(progress, m);

    // 升阶（任一完整轮次准确率 ≥85，封顶 S5）
    if (shouldAdvanceStage(r) && progress.stage < MAX_STAGE) progress = { ...progress, stage: progress.stage + 1 };

    const streak = applyStreak(state.streak, today);
    const daily = applyDaily(state.daily, today, sess.correct);
    void repo.addSession({
      ts: now.getTime(), mode: 'tap', clef: cfg.clef, stage: cfg.stage,
      correct: sess.correct, total: sess.total, durationSec: cfg.durationSec,
      speed: r.speed, accuracy: r.accuracy,
    });
    setState((prev) => ({ ...prev, progress, streak, daily }));
    go('result');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  function onTap(label: string) {
    const pc = BUTTON_PC[label as keyof typeof BUTTON_PC];
    setSess((s) => answerTap(s, pc));
  }

  const fb = sess.last === null ? 'none' : sess.last.result === 'correct' ? 'ok' : 'bad'; // 对齐样式 .fb.ok/.fb.bad
  const fbText =
    sess.last === null
      ? '看谱，点出这个音的名字'
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
    </main>
  );
}
```

- [ ] **Step 6: 实现 ResultScreen.tsx**

`src/ui/ResultScreen.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { useApp } from '../app/state';
import { makeDay } from '../core/storage/logic';
import type { SessionRecord } from '../core/storage/types';

export function ResultScreen() {
  const { go, repo, state } = useApp();
  const [last, setLast] = useState<SessionRecord | null>(null);
  useEffect(() => {
    void repo.listSessions().then((all) => {
      if (all.length) setLast(all[all.length - 1]); // 最新记录在末位
    });
  }, [repo]);
  const today = makeDay(new Date());
  return (
    <main className="screen result">
      <h1>本轮完成</h1>
      <div className="card">
        {last
          ? `正确 ${last.correct} 音 · ${last.speed} 音/分 · 准确率 ${last.accuracy}%`
          : '记录计算中…'}
      </div>
      <div className="card">
        今日打卡 {state.streak.lastDate === today ? '✓' : '·'} 连续 {state.streak.current} 天 · 当前 S{state.progress.stage}
      </div>
      <div className="row">
        <button className="primary" onClick={() => go('setup')}>再来一轮</button>
        <button className="ghost" onClick={() => go('home')}>返回</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: 更新 App.tsx 接入 Practice / Result**

`src/app/App.tsx`（覆盖 Task 8 版本）：

```tsx
import { AppProvider, useApp } from './state';
import { HomeScreen } from '../ui/HomeScreen';
import { PracticeScreen } from '../ui/PracticeScreen';
import { ResultScreen } from '../ui/ResultScreen';

export function AppRoot({ repoKind }: { repoKind?: 'memory' | 'auto' }) {
  return (
    <AppProvider repoKind={repoKind}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { ready, view } = useApp();
  if (!ready) return <div className="boot">载入中…</div>;
  switch (view) {
    case 'practice': return <PracticeScreen />;
    case 'result': return <ResultScreen />;
    case 'setup': return <div className="boot">开始设置（Task 11 接入）</div>;
    case 'stats': return <div className="boot">数据视图（Task 11 接入）</div>;
    case 'settings': return <div className="boot">设置（Task 11 接入）</div>;
    case 'home':
    default: return <HomeScreen />;
  }
}
```

- [ ] **Step 8: 全量测试 + 类型检查**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run
npx tsc -b # 类型门禁：根 tsconfig 为 references 方案，单独跑 --noEmit 是空操作，须用 -b
```
Expected: 全绿、无类型错误。

- [ ] **Step 9: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash
git commit -m "feat(sightflash): 认音练习会话 + 练习/结算视图"
```

---

### Task 11: 开始设置 + 数据/设置页 + 全流程接通

**Files:**
- Create: `src/ui/SetupScreen.tsx`
- Create: `src/ui/StatsScreen.tsx`
- Create: `src/ui/SettingsScreen.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: 实现 SetupScreen.tsx**

`src/ui/SetupScreen.tsx`：

```tsx
import { useApp } from '../app/state';
import { clefUnlockStage } from '../core/generator/stages';
import type { MixedClef } from '../core/generator/stages';

const CLEFS: Array<{ key: MixedClef; label: string; locked: string }> = [
  { key: 'treble', label: '高音谱', locked: '' },
  { key: 'bass', label: '低音谱', locked: '（S2 解锁）' },
  { key: 'mixed', label: '高/低混合', locked: '（S3 解锁）' },
];

export function SetupScreen() {
  const { state, setState, go } = useApp();
  const stage = state.progress.stage;

  function start(clef: MixedClef) {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, lastClef: clef, lastMode: 'tap' } }));
    go('practice');
  }

  return (
    <main className="screen setup">
      <h1>开始训练</h1>
      <div className="card">当前阶段 S{stage} · 模式：认音</div>
      <div className="card">
        <div className="label">选择谱号</div>
        {CLEFS.map((c) => {
          const unlocked = stage >= clefUnlockStage(c.key);
          return (
            <button key={c.key} className="sel" disabled={!unlocked} onClick={() => start(c.key)}>
              {c.label} {unlocked ? '' : c.locked}
            </button>
          );
        })}
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
```

- [ ] **Step 2: 实现 StatsScreen.tsx**

`src/ui/StatsScreen.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { useApp } from '../app/state';
import { speedTrend, latestAccuracies, errorDistribution } from '../core/stats';
import { midiToName } from '../core/notation/note';
import type { SessionRecord } from '../core/storage/types';

export function StatsScreen() {
  const { go, repo, state } = useApp();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  useEffect(() => { void repo.listSessions().then(setSessions); }, [repo]);

  const trend = speedTrend(sessions).slice(-20);
  const acc = latestAccuracies(sessions);
  const errs = errorDistribution(state.progress.wrong).slice(0, 8);
  const maxSpeed = Math.max(1, ...trend.map((p) => p.value));
  const maxErr = Math.max(1, ...errs.map((e) => e.count));

  return (
    <main className="screen stats">
      <h1>练习数据</h1>
      <div className="card">
        <div className="label">速度趋势（音/分）</div>
        {trend.length === 0
          ? <div className="small">先完成一轮训练再来看曲线吧</div>
          : (
            <svg viewBox="0 0 300 100" className="chart">
              {trend.map((p, i) => {
                const x = trend.length > 1 ? (i / (trend.length - 1)) * 290 + 5 : 150;
                const y = 90 - (p.value / maxSpeed) * 80;
                return <circle key={i} cx={x} cy={y} r={3} fill="#38bdf8" />;
              })}
            </svg>
          )}
        <div className="small">{trend.length} 条记录</div>
      </div>
      <div className="card">
        <div className="label">最近准确率：{acc.length ? `${acc[acc.length - 1]}%` : '—'}</div>
      </div>
      <div className="card">
        <div className="label">常错音符</div>
        {errs.length === 0 && <div className="small">暂无错音，继续保持！</div>}
        {errs.map((e) => (
          <div key={e.midi} className="err-row">
            <span>{midiToName(e.midi)}</span>
            <div className="bar"><div className="bar-fill warn" style={{ width: `${(e.count / maxErr) * 100}%` }} /></div>
            <span>{e.count}</span>
          </div>
        ))}
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
```

- [ ] **Step 3: 实现 SettingsScreen.tsx**

`src/ui/SettingsScreen.tsx`：

```tsx
import { useApp } from '../app/state';
import { defaultState } from '../core/storage/logic';

export function SettingsScreen() {
  const { state, setState, repo, go } = useApp();
  return (
    <main className="screen settings">
      <h1>设置</h1>
      <div className="card">
        <div className="row"><span>提示音</span>
          <button className="sel small" onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, sound: !p.settings.sound } }))}>
            {state.settings.sound ? '开' : '关'}
          </button>
        </div>
        <div className="row"><span>每轮时长</span>
          {[30, 60].map((d) => (
            <button key={d} className="sel small" onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, durationSec: d } }))}>
              {d}s{state.settings.durationSec === d ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <button className="danger" onClick={async () => {
          await repo.clearAll();
          setState(() => defaultState());
        }}>清除本地数据</button>
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
```

- [ ] **Step 4: 更新 App.tsx 接入剩余视图**

`src/app/App.tsx`：

```tsx
import { AppProvider, useApp } from './state';
import { HomeScreen } from '../ui/HomeScreen';
import { SetupScreen } from '../ui/SetupScreen';
import { PracticeScreen } from '../ui/PracticeScreen';
import { ResultScreen } from '../ui/ResultScreen';
import { StatsScreen } from '../ui/StatsScreen';
import { SettingsScreen } from '../ui/SettingsScreen';

export function AppRoot({ repoKind }: { repoKind?: 'memory' | 'auto' }) {
  return (
    <AppProvider repoKind={repoKind}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { ready, view } = useApp();
  if (!ready) return <div className="boot">载入中…</div>;
  switch (view) {
    case 'practice': return <PracticeScreen />;
    case 'setup': return <SetupScreen />;
    case 'result': return <ResultScreen />;
    case 'stats': return <StatsScreen />;
    case 'settings': return <SettingsScreen />;
    case 'home':
    default: return <HomeScreen />;
  }
}
```

- [ ] **Step 4b: 更新 App.test.tsx 的 setup 导航断言**

Task 8 的导航测试断言 setup 占位文本「开始设置（Task 11 接入）」（`src/app/App.test.tsx` 的 `点"开始训练"进入 setup 视图`）。Task 11 把占位换成真实 SetupScreen（h1 为「开始训练」，含「选择谱号」标签），该断言必须改为断言真实页特征文本，否则全量测试会红。把 `expect(await screen.findByText(/开始设置/)).toBeInTheDocument();` 改为 `expect(await screen.findByText(/选择谱号/)).toBeInTheDocument();`。

- [ ] **Step 5: 运行全量测试 + 构建冒烟**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run
npx tsc -b # 类型门禁：根 tsconfig 为 references 方案，单独跑 --noEmit 是空操作，须用 -b
npm run build
```
Expected: 测试全绿；tsc 无错；build 成功产出 `dist/`（含 PWA workbox 产物）。

- [ ] **Step 6: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash
git commit -m "feat(sightflash): 设置/统计页 + 首页导航，认音模式全流程可用"
```

---

### Task 12: 补 README + 真机验收清单（里程碑 A 收尾）

**Files:**
- Create: `sightflash/README.md`

- [ ] **Step 1: 写 README.md**

`sightflash/README.md`：

````markdown
# 五线速读 SightFlash

把「五线谱 ↔ 音名 ↔ 琴键」练成条件反射的识谱反应训练器（PWA，手机可用）。

## 里程碑 A（当前）：认音模式
看谱 → 点音名按钮。难度阶梯 S1~S5、错音加权复习、打卡/连击、速度/准确率曲线、本地数据（IndexedDB）。

里程碑 B（规划中）：跟弹模式 —— 麦克风音高判定（真琴弹奏）。
设计文档：`docs/superpowers/specs/2026-09-05-sightflash-design.md`

## 开发

```bash
npm install
npm run dev        # localhost
npm test           # vitest 全量
npm run build      # 产出 dist/（PWA）
```

## 真机验收清单（里程碑 A）
- [ ] 手机浏览器打开 https 页面（认音模式无需麦克风）
- [ ] 首页 → 开始训练 → 选高音谱 → 练一轮：谱面渲染正确、点音名判对/错、到点自动结算
- [ ] 答错后「常错音符」出现该音；重复练到准确率 ≥85% 自动升 S2（低音谱解锁）
- [ ] 混合模式（S3 后）：同一题明确显示高音或低音谱
- [ ] 今日目标随正确数累加、跨天清零；连续天数正确累计
- [ ] 「添加到主屏幕」安装为 PWA；断网重开仍可用、数据不丢
- [ ] 数据页速度曲线 / 错音分布与练习记录一致

## 里程碑 B 接入点
- `src/core/generator`（chooseQuestion）已产出 `{midi, clef}` —— 跟弹模式直接复用
- `src/core/session.ts` 状态机：跟弹模式以「起音事件→音高判定」替代「按钮→音级判定」，加一个 `answerPlay`
- `StaffView`、打卡/统计/存储全部复用
````

- [ ] **Step 2: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash
git commit -m "docs(sightflash): 里程碑 A README 与验收清单"
```

- [ ] **Step 3: 完整验收构建**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npm test && npm run build
```
Expected: 全绿 + 构建成功。**本计划（里程碑 A）完成。**

---

## 设计文档覆盖自检

| 设计章节 | 对应任务 |
|---|---|
| 5 核心循环（认音方向） | Task 10（PracticeScreen + session.ts） |
| 6 出题 / 错音加权 / 升阶 | Task 4、Task 6、Task 10 |
| 7 谱号与阶梯 S1~S5、解锁门槛 | Task 4 stages + Task 11 Setup 置灰 |
| 9 打卡 / 结算反馈 | Task 6 applyStreak/applyDaily + Task 10/11 |
| 10 数据与统计 | Task 6/7 + Task 11 StatsScreen |
| 11/12 架构与目录 | 全程 |
| 13 UI 视图（首页/开始/练习/结算/数据/设置） | Task 8-11 |
| 14 错误处理（无 IndexedDB 降级） | Task 8 makeRepo 内存兜底 |
| 15 测试策略 | 各 Task TDD + 几何单测 |
| 16 真机 / 部署 | Task 12 清单（PWA 已配置） |
| 17 MVP 范围 | 本计划 = MVP 的认音部分 |

**里程碑 B（后续独立计划，本计划未涉及）**：麦克风授权/校准、YIN 音高检测（含合成正弦波单测）、onset 起音检测、`answerPlay` 判定与反馈、真机识别调优。
