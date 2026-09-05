# SightFlash 键盘横屏 + 三音区 + 中央C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机横屏优先使用（Android PWA 自动横屏 + 自适应布局 + 竖屏提示）；钢琴琴键窗口由 2 个八度扩为 **3 个八度**（高音题 C3~C6、低音题 C2~C5，均含中央C）；仅在**中央C(C4) 白键**加圆点作唯一参照。

**Architecture:** 纯 UI 层改动，不动 core（出题/判定/发声全不变——扩出的键只是可弹范围，判定仍 `answerKey` 精确八度）。`Piano.tsx` 的 `RANGE` 常量改窗口 + 加中央C圆点子元素；`index.css` 加圆点样式与 `orientation: landscape` 媒体查询（放宽 `#root` 上限、放大键盘、隐藏竖屏提示）；`vite.config.ts` manifest 加 `orientation:'landscape'`；`PracticeScreen.tsx` 顶部加竖屏提示条。

**Tech Stack:** Vite 8 / React 19 / TS strict / vitest(jsdom)。**类型门禁一律 `npx tsc -b`**（solution-style tsconfig，`tsc --noEmit` 是空操作）。

**设计依据：** `sightflash/docs/superpowers/specs/2026-09-05-sightflash-design.md` §21 增补（已批准，取代 §20.1 窗口尺寸）。

**既有事实：**
- 出题区（不随本计划变）：高音池 C4~G5(midi 60–79)、低音池 G2~C4(43–60)。判定 `answerTap`(字母按音级) / `answerKey`(琴键精确八度) 均不变。
- `Piano.tsx` 命名与 `ui/piano.ts` 同基名异大小写：**导本组件须 `./Piano.tsx`、引擎 `./piano.ts`**（见 Piano.tsx 头注）。
- 仓库根 `d:/OneDrive/claude_project/cleaner`；提交只 `git add` 具体文件；工作树此时应干净（上一特性已推 `f8e800a`）。

---

## 通用约定

- 每任务跑：`npx vitest run <相关>`、`npx tsc -b`（exit 0）。全量基线现为 **63 tests / 13 files**。

---

### Task R1: 琴键窗口扩为 3 个八度 + 中央C 圆点

**Files:**
- Modify: `sightflash/src/ui/Piano.tsx`
- Modify: `sightflash/src/ui/Piano.test.tsx`（整文件替换为下面内容）
- Modify: `sightflash/src/index.css`（追加 `.c4` 圆点样式；给 `.key.white` 加 `position: relative`）

- [ ] **Step 1: 替换测试为失败版 `sightflash/src/ui/Piano.test.tsx`**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Piano } from './Piano.tsx';

afterEach(() => {
  cleanup();
});

describe('Piano', () => {
  it('高音窗口 C3~C6：22 白键 + 15 黑键，边界 C3/C6', () => {
    const onKey = vi.fn();
    render(<Piano clef="treble" onKey={onKey} />);
    expect(screen.getAllByTestId(/^w-/)).toHaveLength(22);
    expect(screen.getAllByTestId(/^b-/)).toHaveLength(15);
    expect(screen.getByTestId('w-48')).toBeInTheDocument(); // C3
    expect(screen.getByTestId('w-84')).toBeInTheDocument(); // C6
    expect(screen.getByTestId('b-61')).toBeInTheDocument(); // C#4
  });

  it('低音窗口 C2~C5：22 白键 + 15 黑键，边界 C2/C5', () => {
    const onKey = vi.fn();
    render(<Piano clef="bass" onKey={onKey} />);
    expect(screen.getAllByTestId(/^w-/)).toHaveLength(22);
    expect(screen.getAllByTestId(/^b-/)).toHaveLength(15);
    expect(screen.getByTestId('w-36')).toBeInTheDocument(); // C2
    expect(screen.getByTestId('w-72')).toBeInTheDocument(); // C5
    expect(screen.getByTestId('b-66')).toBeInTheDocument(); // F#4
  });

  it('仅中央C(C4=60) 白键带一个 c4 圆点（高音/低音窗口都有）', () => {
    const onKey = vi.fn();
    const first = render(<Piano clef="treble" onKey={onKey} />);
    expect(screen.queryAllByTestId('c4-marker')).toHaveLength(1);
    expect(within(screen.getByTestId('w-60')).getByTestId('c4-marker')).toBeInTheDocument();
    first.unmount();
    render(<Piano clef="bass" onKey={onKey} />);
    expect(screen.queryAllByTestId('c4-marker')).toHaveLength(1);
    expect(within(screen.getByTestId('w-60')).getByTestId('c4-marker')).toBeInTheDocument();
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
Expected: FAIL（窗口仍 2 八度：白键 15/黑键 10，无 w-48/w-36、无 c4-marker）。

- [ ] **Step 3: 改 `sightflash/src/ui/Piano.tsx`**

把顶部注释与两个常量改掉，并在白键 map 里给中央C加圆点。改动后文件整体应为：

```tsx
import { useMemo } from 'react';
import type { Clef } from '../core/notation/positions';

// 注意：与 ui/piano.ts（发声引擎）同基名异大小写。Windows 大小写不敏感下省略扩展名会误解析，
// 导入本组件须写 ./Piano.tsx、导入引擎须写 ./piano.ts。
const BLACK_PC = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A#
/** 琴键窗口（含两端）各 3 个八度：高音 C3~C6(midi 48–84)、低音 C2~C5(midi 36–72)。
 *  均含中央C(C4=60)；端点均为自然音白键；完整覆盖出题区（高 C4~G5 / 低 G2~C4）并可往下/上弹。 */
const RANGE: Record<Clef, [number, number]> = { treble: [48, 84], bass: [36, 72] };
const BLACK_W = 0.62; // 黑键宽 = 白键宽的 0.62
const MIDDLE_C = 60; // 中央C，唯一参照键

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

/** 仿真钢琴键盘：点击琴键（白/黑）回调 onKey(midi)。除中央C(C4)底部圆点外不标任何文字。 */
export function Piano({ clef, onKey }: { clef: Clef; onKey: (midi: number) => void }) {
  const [lo, hi] = RANGE[clef];
  const whites = useMemo(() => naturals(lo, hi), [lo, hi]);
  const blackList = useMemo(() => blacks(lo, hi), [lo, hi]);
  const whiteIdx = useMemo(() => new Map(whites.map((m, i) => [m, i])), [whites]);
  return (
    <div className="piano" role="group" aria-label="钢琴键盘">
      {whites.map((m) => (
        <div key={m} data-testid={`w-${m}`} data-midi={m} className="key white"
          onPointerDown={(e) => { e.preventDefault(); onKey(m); }}>
          {m === MIDDLE_C && <span className="c4" data-testid="c4-marker" aria-label="中央C" />}
        </div>
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

（仅改动注释、`RANGE`、新增 `MIDDLE_C` 与圆点 `span`；其余逻辑与原来逐字相同。）

- [ ] **Step 4: `index.css` 追加圆点样式并给白键定位**

把现有 `.piano .key.white { flex: 1 1 0; background: ...; ... }` 一行改为在开头加 `position: relative;`：

```css
.piano .key.white { flex: 1 1 0; position: relative; background: linear-gradient(#f8fafc, #dbe3ea);
  border-right: 1px solid #94a3b8; border-radius: 0 0 4px 4px; }
```

并在文件末尾（现有 piano 规则后）追加：

```css
/* 中央C(C4) 唯一参照圆点 */
.piano .key.white .c4 { position: absolute; left: 50%; bottom: 5px; width: 8px; height: 8px;
  border-radius: 50%; background: #eab308; transform: translateX(-50%);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, .35); }
```

- [ ] **Step 5: 测试 PASS + 全量 + 门禁**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run src/ui/Piano.test.tsx   # 4 passed
npx vitest run                          # 全量 63+? （原 63 不动，Piano 用例数变化仅计数：保持全绿）
npx tsc -b                              # exit 0
```

- [ ] **Step 6: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/src/ui/Piano.tsx sightflash/src/ui/Piano.test.tsx sightflash/src/index.css
git commit -m "feat(sightflash): 琴键窗口扩至 3 八度并加中央C参照圆点"
```

---

### Task R2: 横屏优先（manifest + 自适应 CSS + 竖屏提示）

**Files:**
- Modify: `sightflash/vite.config.ts`（manifest 加 `orientation: 'landscape'`）
- Modify: `sightflash/src/index.css`（追加 `.rotate-hint` 与 `@media (orientation: landscape)` 自适应块）
- Modify: `sightflash/src/ui/PracticeScreen.tsx`（`<main className="screen practice">` 内顶部加竖屏提示条）
- Modify: `sightflash/README.md`（里程碑 A 下补一句横屏提示）

- [ ] **Step 1: `vite.config.ts` manifest 加横屏**

在 manifest 对象里（`display: 'standalone',` 之后）加一行：

```ts
        orientation: 'landscape',
```

- [ ] **Step 2: `index.css` 末尾追加横屏自适应**

```css
/* 竖屏提示：仅竖屏显示，横屏自动隐藏 */
.rotate-hint { display: flex; align-items: center; justify-content: center; gap: 8px;
  margin: 0 auto 10px; max-width: 480px; background: #1e293b; color: #94a3b8;
  font-size: .85rem; border: 1px solid #334155; border-radius: 8px; padding: 6px 10px; }

@media (orientation: landscape) {
  #root { max-width: 920px; }
  .rotate-hint { display: none; }
  .practice .staff-wrap svg { max-width: 210px; }
  .practice .note-btn { max-width: 64px; }
  .practice .piano { max-width: 920px; height: 185px; }
}
```

- [ ] **Step 3: `PracticeScreen.tsx` 顶部加提示条**

在 `return (<main className="screen practice">` 之后、第一行 header `<div className="row space-between">` 之前插入：

```tsx
      <p className="rotate-hint" role="note" data-testid="rotate-hint">横屏使用键位更宽 ↻</p>
```

- [ ] **Step 4: `README.md` 里程碑 A 下补横屏提示**

在现有「看谱 → 点音名按钮或仿真钢琴琴键（可听该音钢琴音）。…」那行下面另起一行（作为特性说明小字，不必加新标题）：

`提示：手机建议横屏使用（Android 安装 PWA 后自动横屏；iPhone 旋转即可）。琴键窗口含 3 个八度，中央 C 键有圆点参照。`

- [ ] **Step 5: 全量 + 门禁**

```bash
cd "d:/OneDrive/claude_project/cleaner/sightflash"
npx vitest run   # 全绿（PracticeScreen 加了提示条；若无测试断言该屏具体子元素即不受影响）
npx tsc -b       # exit 0
```

若某组件/App 测试因 PracticeScreen 新增 `rotate-hint` 而失败（例如快照/全量文本断言），如实报告；不要静默删除/掩盖断言——先判断新提示条是否破坏其意图。

- [ ] **Step 6: 提交**

```bash
cd "d:/OneDrive/claude_project/cleaner"
git add sightflash/vite.config.ts sightflash/src/index.css sightflash/src/ui/PracticeScreen.tsx sightflash/README.md
git commit -m "feat(sightflash): 横屏优先（manifest 锁横屏 + 自适应布局 + 竖屏提示）"
```

---

## 覆盖自检

| 规格（§21） | 对应任务 |
|---|---|
| 21.1 manifest `orientation: 'landscape'` | R2 Step 1 |
| 21.1 横屏自适应（`#root` 放宽 + 键盘增高增宽 + 音符按钮限宽） | R2 Step 2 |
| 21.1 竖屏「建议横屏」提示条（横屏隐藏） | R2 Step 2/3 |
| 21.2 高音窗 C3~C6、低音窗 C2~C5（各 22 白/15 黑） | R1 RANGE |
| 21.2 扩出键仅为可弹范围，判定/发声不变（core 不动） | R1（无 core 改动） |
| 21.3 仅 C4 圆点（`c4-marker`），不标其它字母 | R1 MIDDLE_C + `.c4` |
| 回归：2 八度→3 八度后测试边界更新 | R1 Step 1 测试 |
