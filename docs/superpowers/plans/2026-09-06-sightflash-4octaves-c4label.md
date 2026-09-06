# 键盘固定 4 整八度 + 中央C 文字标注 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仿真钢琴键盘由「随谱号切换的 3 八度窗」改为**固定单一窗口 C2~C6（4 个整八度，29 白 / 20 黑）**，使中央 C（C4=60）恒为正中白键、不随高低音题移位；并把中央 C 的琥珀圆点改成**文字 "C4"**。

**Architecture:** 纯前端展示改动，不动出题/判定/发声逻辑。`Piano` 去掉 `clef` 入参与 `RANGE` 映射，改为模块常量窗口 `LO=36(C2)~HI=84(C6)`；`PracticeScreen` 不再向 `<Piano>` 传 clef。中央 C 标记元素由空 `span.c4`（CSS 圆点）改为含文本 "C4" 的 `span.c4`（CSS 文字标注）。

**Tech Stack:** React/TS + vitest(jsdom) + CSS。规格依据：设计文档 §23（取代 §21.2/§21.3）。

**范围：** 只改 4 个文件——
- `sightflash/src/ui/Piano.tsx`（固定窗口、去 clef、C4 文本）
- `sightflash/src/ui/Piano.test.tsx`（单窗口断言重写）
- `sightflash/src/ui/PracticeScreen.tsx`（第 100 行去掉 clef 传参）
- `sightflash/src/index.css`（`.c4` 圆点块 → 文字标注块，仅此一处，横屏媒体块与竖屏基类一律不动）
另：`sightflash/README.md` 里程碑 A 措辞同步。

---

### Task 1: 固定窗口 C2~C6 + 中央C 文字 "C4"（代码 + 测试 + CSS）

**Files:**
- Modify: `sightflash/src/ui/Piano.tsx`
- Modify: `sightflash/src/ui/Piano.test.tsx`
- Modify: `sightflash/src/ui/PracticeScreen.tsx:100`
- Modify: `sightflash/src/index.css`（`.piano .key.white .c4` 一处）

环境注意：本机 vitest 必须 `--maxWorkers=1`（默认并行会 OOM）。测试/构建在 `sightflash/` 目录下执行。类型门禁用 `npx tsc -b`（solution-style，`tsc --noEmit` 是空操作）。`piano.ts`（发声引擎）与 `Piano.tsx` 同基名异大小写，Windows 下导入必须写显式扩展名——本任务不动 `piano.ts`，但改 `PracticeScreen.tsx` 时不要动其 `import { playPiano } from './piano.ts'` 行。

- [ ] **Step 1: 用下面的内容整体重写 `sightflash/src/ui/Piano.test.tsx`（先写失败测试）**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Piano } from './Piano.tsx';

afterEach(() => {
  cleanup();
});

describe('Piano', () => {
  it('固定窗口 C2~C6（4 个整八度）：29 白键 + 20 黑键，边界 C2/C6、首黑 C#2', () => {
    const onKey = vi.fn();
    render(<Piano onKey={onKey} />);
    expect(screen.getAllByTestId(/^w-/)).toHaveLength(29);
    expect(screen.getAllByTestId(/^b-/)).toHaveLength(20);
    expect(screen.getByTestId('w-36')).toBeInTheDocument(); // C2
    expect(screen.getByTestId('w-84')).toBeInTheDocument(); // C6
    expect(screen.getByTestId('b-37')).toBeInTheDocument(); // C#2
  });

  it('中央C(C4=60) 白键带唯一文字标注 "C4"，其余 C 键无标注', () => {
    const onKey = vi.fn();
    render(<Piano onKey={onKey} />);
    expect(screen.queryAllByTestId('c4-marker')).toHaveLength(1);
    const marker = within(screen.getByTestId('w-60')).getByTestId('c4-marker');
    expect(marker.textContent).toBe('C4');
    for (const m of [36, 48, 72, 84]) {
      expect(within(screen.getByTestId(`w-${m}`)).queryByTestId('c4-marker')).toBeNull();
    }
  });

  it('按下琴键触发 onKey(对应 midi)', () => {
    const onKey = vi.fn();
    render(<Piano onKey={onKey} />);
    fireEvent.pointerDown(screen.getByTestId('w-62')); // D4
    expect(onKey).toHaveBeenCalledWith(62);
    fireEvent.pointerDown(screen.getByTestId('b-63')); // D#4
    expect(onKey).toHaveBeenCalledWith(63);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run（在 `sightflash/` 下）: `npx vitest run --maxWorkers=1 src/ui/Piano.test.tsx`
Expected: FAIL（旧组件还有 `clef` 入参、窗口 22 白，白键数/黑键数/边界断言不匹配）。

- [ ] **Step 3: 用下面的内容整体重写 `sightflash/src/ui/Piano.tsx`**

```tsx
// 注意：与 ui/piano.ts（发声引擎）同基名异大小写。Windows 大小写不敏感下省略扩展名会误解析，
// 导入本组件须写 ./Piano.tsx、导入引擎须写 ./piano.ts。
import { useMemo } from 'react';

const BLACK_PC = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A#
/** 固定琴键窗口 C2~C6（midi 36–84，4 个整八度）：29 白键 / 20 黑键。
 *  端点均为自然音白键；窗口不随谱号切换，中央C(C4=60) 恒为正中第 15 白键
 *  （混合模式换谱时位置不动，作稳定参照）。完全覆盖题目音池（高 C4~G5 / 低 G2~C4）。 */
const LO = 36; // C2
const HI = 84; // C6
const MIDDLE_C = 60; // 中央C，唯一标注键：文字 "C4"
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

/** 仿真钢琴键盘：点击琴键（白/黑）回调 onKey(midi)。画出来由调用方决定发声与判定。
 *  仅中央C(C4) 白键标注文字 "C4"，其余琴键无任何额外标记。 */
export function Piano({ onKey }: { onKey: (midi: number) => void }) {
  const whites = useMemo(() => naturals(LO, HI), []);
  const blackList = useMemo(() => blacks(LO, HI), []);
  const whiteIdx = useMemo(() => new Map(whites.map((m, i) => [m, i])), [whites]);
  return (
    <div className="piano" role="group" aria-label="钢琴键盘">
      {whites.map((m) => (
        <div key={m} data-testid={`w-${m}`} data-midi={m} className="key white"
          onPointerDown={(e) => { e.preventDefault(); onKey(m); }}>
          {m === MIDDLE_C && <span className="c4" data-testid="c4-marker">C4</span>}
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

要点：
- 删掉 `import type { Clef } from '../core/notation/positions';`、`RANGE` 映射、组件 `clef` 入参与 `[lo, hi]` 解构。
- `useMemo(..., [])` 依赖空数组是刻意的（`LO/HI/MIDDLE_C` 为模块常量，永不变化），勿加依赖造成每帧重算。
- 其它键渲染、黑键定位算法、`BLACK_W` 一律保持原样。

- [ ] **Step 4: 改 `sightflash/src/ui/PracticeScreen.tsx` 第 100 行**

`<Piano clef={sess.target.clef} onKey={onKey} />` → `<Piano onKey={onKey} />`
（`sess.target.clef` 仍用于 `StaffView` 与谱名显示，只去掉 `Piano` 的传参；文件顶部 import 行、`./piano.ts` 导入行均不动。）

- [ ] **Step 5: 改 `sightflash/src/index.css` 的 `.c4` 块（唯一 CSS 改动）**

把这段（现第 45–48 行附近）：
```css
/* 中央C(C4) 唯一参照圆点 */
.piano .key.white .c4 { position: absolute; left: 50%; bottom: 5px; width: 8px; height: 8px;
  border-radius: 50%; background: #eab308; transform: translateX(-50%);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, .35); }
```
整段替换为：
```css
/* 中央C(C4) 唯一文字标注：白键下缘小字，避开其上黑键区（黑键高 62%）。字色偏琥珀、对照白键浅底 */
.piano .key.white .c4 { position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%);
  font-size: clamp(8px, 1.4vw, 12px); line-height: 1; font-weight: 600; color: #b45309;
  pointer-events: none; user-select: none; }
```
要点：**只允许替换这一个 `.c4` 块**。`.piano{height:150px}` 等竖屏基类、横屏 `@media (orientation: landscape)` 整块（含 `.staff-wrap` 限宽注释）、`.key.black` 等一律不碰。

- [ ] **Step 6: 跑 Piano 测试确认通过**

Run（在 `sightflash/` 下）: `npx vitest run --maxWorkers=1 src/ui/Piano.test.tsx`
Expected: PASS（3 用例）。

- [ ] **Step 7: 全量回归 + 类型门禁 + 构建**

Run（在 `sightflash/` 下）:
- `npx vitest run --maxWorkers=1` → 全绿（其余 65+ 用例不受影响）
- `npx tsc -b` → exit 0
- `npm run build` → 成功产出 `dist/`

- [ ] **Step 8: 真机视觉冒烟（headless 可选）**

若本机可用 headless Chrome，截一张横屏练习屏图确认：29 白键横向铺满、中央 C 白键（w-60）下缘有清晰小字 "C4"、不被黑键压住。若字号在窄横屏下挤到白键边缘，允许把 `clamp` 下限微调到 `7px`（并在 commit 说明里记录实测视口宽）。此步不可用时如实说明，交主会话做真机验收。

- [ ] **Step 9: 提交**

```bash
git add src/ui/Piano.tsx src/ui/Piano.test.tsx src/ui/PracticeScreen.tsx src/index.css
git commit -m "feat(sightflash): 键盘固定 C2~C6 四整八度，中央C 圆点改文字 C4（§23）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

- [ ] **Step 10: 自评（向主会话报告）**
  - 确认 `Piano` 已无 `clef` 入参、`RANGE` 已删、窗口常量为 `LO=36/HI=84`；`c4-marker` 文本为 "C4" 且仅 w-60 一处。
  - 确认 CSS 只改了 `.c4` 块；`PracticeScreen` 只改了第 100 行。
  - 确认全量 vitest 绿 + `tsc -b` exit 0 + build 成功。
  - 状态：DONE / DONE_WITH_CONCERNS / BLOCKED。

**验收（真机，后续由主会话交 boss 做，不在本任务自动判定）：** 混合模式高低音题切换时整条键盘（中央 C 标 "C4" 白键）物理位置不动；中央 C 键可见文字 "C4"；横屏 29 白键仍可手按；竖屏/其它屏幕不受影响。

---

### Task 2: README 里程碑 A 措辞同步

**Files:**
- Modify: `sightflash/README.md`（第 7 行一句 + 验收清单加一项）

- [ ] **Step 1: 改第 7 行提示句**

把「提示：手机建议横屏使用（Android 安装 PWA 后自动横屏；iPhone 旋转即可）。琴键窗口含 3 个八度，中央 C 键有圆点参照。横屏下练习屏整屏放全、无纵向滚动，键盘高度随屏高自适应。」中的「琴键窗口含 3 个八度，中央 C 键有圆点参照。」替换为「仿真键盘固定为 C2~C6 四个整八度、不随谱号移位，中央 C 键标文字「C4」。」其余文字保持原样。

- [ ] **Step 2: 验收清单加一项（放在现有钢琴/横屏相关项附近）**

在 `- [ ] 混合模式（S3 后）：同一题明确显示高音或低音谱` 之后插入：
`- [ ] 混合模式换谱时键盘不随谱切换（固定 C2~C6 四整八度），中央 C(C4) 位置不动且白键下缘标文字 "C4"`

- [ ] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs(sightflash): README 同步键盘四整八度 + 中央C文字标注（§23）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
