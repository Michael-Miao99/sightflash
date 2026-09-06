# SightFlash A2 大谱表（真钢琴谱单音）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把认音模式「混合（高/低）」的谱面从单行谱换成真钢琴大谱表——双行五线 + 贯通大括号 + 高低双谱号同屏，一次单音画在所属行；高/低单谱模式保持现有单行谱不变（规格 §25）。

**Architecture:** 新增 `src/ui/GrandStaffView.tsx`，用「连续全局步进轴」把两行谱拼成一张：低音行底线 G2 = 全局步 0，高音行 = 低音行之上偏移 12 个局部步（中央 C 加线两谱同一高度）。定位仍复用现有 `positions.layoutStaffNote(letterMidi, clef)` 求局部步 + 偏移；`positions.ts`/`note.ts` **零改动**。`PracticeScreen` 在 `cfg.clef === 'mixed'` 时渲染 grand，否则单行 `StaffView`；表头混合态显示「大谱表」。svg 尺寸交给 CSS 控制（横屏按高度 `clamp`、竖屏限宽），内部常量可调。

**Tech Stack:** React 19 / TS strict / vitest(jsdom) + @testing-library / 现有 CSS（横屏 §22 flex 一屏预算）。

> 环境铁律（沿用项目惯例，见 A1 计划）：vitest 本机必须 `--maxWorkers=1`；类型门禁 = `npx tsc -b`（根解式工程，`tsc --noEmit` 是空操作）；Windows 大小写不敏感故显式扩展名（`./Piano.tsx`）；git 可能报 LF→CRLF（无害）。
> 混合出题机制备忘：`chooseQuestion` 对 `clef='mixed'` 已 50/50 掷出单谱 `sub` 并写入 `Question.clef`——`sess.target.clef` 恒为 `'treble'|'bass'`，绝无 `'mixed'`。所以 `GrandStaffView` 的 `clef` prop 收单谱即可；出题/判题/音名板/琴键**一律不碰**。

---

### Task 1: `GrandStaffView` 组件 + 几何单测

**Files:**
- Create: `sightflash/src/ui/GrandStaffView.tsx`
- Create: `sightflash/src/ui/GrandStaffView.test.tsx`

本任务只加一个纯渲染组件与它的几何单测，不接进 PracticeScreen（Task 2 再接）。

- [ ] **Step 1: 写失败测试** `sightflash/src/ui/GrandStaffView.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GrandStaffView } from './GrandStaffView';

const cyOf = (el: Element | null | undefined, sel: string) =>
  Number(el!.querySelector(sel)!.getAttribute('cy'));

describe('GrandStaffView', () => {
  it('渲染双行五线 + 双谱号 + 大括号 + 音符头', () => {
    const { container } = render(<GrandStaffView midi={67} clef="treble" />); // G4 高音第 2 线
    expect(container.querySelector('[data-testid="grand-staff"]')).not.toBeNull();
    expect(container.querySelectorAll('line.staff-line')).toHaveLength(10); // 两行 × 5 线
    expect(container.querySelector('[data-testid="clef-treble"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="clef-bass"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="brace"]')).not.toBeNull();
    expect(container.querySelector('ellipse.note-head')).not.toBeNull();
  });

  it('双行五线低行在下：全部线按 y1 升序后，上 5 条（高音行）max < 下 5 条（低音行）min', () => {
    const { container } = render(<GrandStaffView midi={60} clef="bass" />);
    const y1s = [...container.querySelectorAll('line.staff-line')]
      .map((l) => Number(l.getAttribute('y1')))
      .sort((a, b) => a - b);
    expect(y1s).toHaveLength(10);
    const upper = y1s.slice(0, 5); // 高音行（y 小 = 靠上）
    const lower = y1s.slice(5); // 低音行（y 大 = 靠下）
    expect(Math.max(...upper)).toBeLessThan(Math.min(...lower));
  });

  it('中央 C(C4) 在低音谱与高音谱的符头同高（共享间隙同一加线高度）', () => {
    const low = render(<GrandStaffView midi={60} clef="bass" />); // C4 低音上加一线
    const high = render(<GrandStaffView midi={60} clef="treble" />); // C4 高音下加一线
    expect(cyOf(low.container, 'ellipse.note-head')).toBe(cyOf(high.container, 'ellipse.note-head'));
    expect(low.container.querySelectorAll('line.ledger')).toHaveLength(1);
    expect(high.container.querySelectorAll('line.ledger')).toHaveLength(1);
  });

  it('低音题符头落在低音行、高音题符头落在高音行（高音题更高）', () => {
    const lowBass = render(<GrandStaffView midi={43} clef="bass" />); // G2 低音底线
    const highTreble = render(<GrandStaffView midi={79} clef="treble" />); // G5 高音顶线上方
    expect(cyOf(lowBass.container, 'ellipse.note-head')).toBeGreaterThan(cyOf(highTreble.container, 'ellipse.note-head'));
  });

  it('acc 记号仍画对（C#4 锚 C4 位置，谱面 ♯）', () => {
    const withAcc = render(<GrandStaffView midi={61} clef="treble" acc="#" />);
    expect(withAcc.container.querySelector('[data-testid="accidental"]')!.textContent).toBe('♯');
    const plain = render(<GrandStaffView midi={60} clef="treble" />);
    expect(cyOf(withAcc.container, 'ellipse.note-head')).toBe(cyOf(plain.container, 'ellipse.note-head'));
  });

  it('自然音不渲染记号元素', () => {
    const { container } = render(<GrandStaffView midi={60} clef="bass" />);
    expect(container.querySelector('[data-testid="accidental"]')).toBeNull();
  });
});

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/ui/GrandStaffView.test.tsx --maxWorkers=1`
Expected: FAIL，报 `Cannot find module './GrandStaffView'`（文件尚未建）。

- [ ] **Step 3: 实现组件** `sightflash/src/ui/GrandStaffView.tsx`

连续全局步进轴：低音行底线 G2=全局 0；高音行 = 低音行之上偏移 `TREBLE_OFFSET=12` 局部步；局部步经 `layoutStaffNote` 求得再加偏移成全局步。中央 C 全局 10（低音上加 10 / 高音下加 -2+12），两谱同线。svg 不加内联宽高，尺寸由 CSS 控制（Task 3）。

```tsx
import { layoutStaffNote } from '../core/notation/positions';
import type { Clef } from '../core/notation/positions';
import { letterMidiOf } from '../core/notation/note';
import type { Accidental } from '../core/notation/note';

// —— 大谱表几何（规格 §25.2/§25.3，真机微调优先改这里 + index.css 的 .grand-staff svg）——
const SPACE = 8; // px / 谱表步（A2 内缩版式；单行 StaffView 用 16，此处按 ~155px 高预算收敛）
const ANCHOR_TOP = 26; // y=0（顶边）对应的全局步；y=(ANCHOR_TOP-g)*SPACE，g 越大越靠上
const TREBLE_OFFSET = 12; // 高音行底线(E4)在低音行底线(G2)之上的全局步；中央 C 两谱同高 ⇒ 连续轴
const W = 320;
const H = 240;
const NOTE_X = 216; // 符头中心 x（与 StaffView 同列，便于心理对齐）
const RX = 7;
const RY = 6;
const STEM = 22; // 符干长（内部 px）
const LEDGER_X1 = 186; // 加线（与 StaffView 同列）
const LEDGER_X2 = 246;
const ACC_X = 182; // 记号 textAnchor=end（与 StaffView 同）
const LINE_STEPS = [0, 2, 4, 6, 8] as const; // 5 线局部步
const BASS_LINE_STEPS = LINE_STEPS; // 低音行全局 0..8
const TREBLE_LINE_STEPS = LINE_STEPS.map((s) => s + TREBLE_OFFSET); // 高音行全局 12..20
const CLEF_GLYPH: Record<Clef, string> = { treble: '𝄞', bass: '𝄢' };
const ACC_GLYPH: Record<Accidental, string> = { '#': '♯', b: '♭' };

/** SVG y 向下增长；全局步越大音越高、y 越小。 */
const stepY = (g: number) => (ANCHOR_TOP - g) * SPACE;

/** 大括号路径：两段外弓 + 中央回折小横，近似钢琴谱贯通括号。x 在 [BRACE_X-4, BRACE_X+18] 内。 */
function bracePath(yTop: number, yBot: number): string {
  const mid = (yTop + yBot) / 2;
  const x0 = 8; // 括号外缘 x
  return [
    `M ${x0} ${yBot}`,
    `C ${x0 + 22} ${yBot}, ${x0 + 22} ${mid + 16}, ${x0 + 4} ${mid}`,
    `C ${x0 + 22} ${mid - 16}, ${x0 + 22} ${yTop}, ${x0} ${yTop}`,
    `M ${x0 + 4} ${mid} L ${x0 + 14} ${mid}`,
  ].join(' ');
}

/** 真钢琴大谱表（混合模式专用）：双行五线 + 贯通括号 + 高低双谱号，单音画在所属行。
 *  clef = 本音所属行（treble 高音行 / bass 低音行）；acc 沿用 §24 变化音拼写（画谱恒用拼写字母定位）。 */
export function GrandStaffView({ midi, clef, acc }: { midi: number; clef: Clef; acc?: Accidental | null }) {
  const lm = letterMidiOf(midi, acc ?? null); // 拼写字母所在音（自然音）
  const { step: localStep, ledgerLines } = layoutStaffNote(lm, clef); // 复用 positions 自然音几何
  const offset = clef === 'treble' ? TREBLE_OFFSET : 0;
  const g = localStep + offset; // 全局步
  const cy = stepY(g);
  return (
    <div className="grand-staff">
      <svg data-testid="grand-staff" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        {BASS_LINE_STEPS.map((s) => (
          <line key={`b${s}`} className="staff-line" x1={76} x2={W - 10} y1={stepY(s)} y2={stepY(s)}
            stroke="#64748b" strokeWidth={1.5} />
        ))}
        {TREBLE_LINE_STEPS.map((s) => (
          <line key={`t${s}`} className="staff-line" x1={76} x2={W - 10} y1={stepY(s)} y2={stepY(s)}
            stroke="#64748b" strokeWidth={1.5} />
        ))}
        {/* 贯通括号：横跨低音行底到高音行顶，画在线下作为整体框架 */}
        <path data-testid="brace" d={bracePath(stepY(TREBLE_OFFSET + 9), stepY(-2))} fill="none"
          stroke="#cbd5e1" strokeWidth={2.5} />
        {/* 双谱号：各居其行中部（行中线 = 局部步 4） */}
        <text data-testid="clef-bass" x={52} y={stepY(4)} dominantBaseline="central" textAnchor="middle"
          fontSize={24} fill="#cbd5e1" fontFamily="'Noto Music','Segoe UI Symbol',serif">{CLEF_GLYPH.bass}</text>
        <text data-testid="clef-treble" x={52} y={stepY(TREBLE_OFFSET + 4)} dominantBaseline="central" textAnchor="middle"
          fontSize={26} fill="#cbd5e1" fontFamily="'Noto Music','Segoe UI Symbol',serif">{CLEF_GLYPH.treble}</text>
        {acc != null && (
          <text data-testid="accidental" x={ACC_X} y={cy + 5} textAnchor="end" fontSize={15}
            fill="#f8fafc" fontFamily="'Noto Music','Segoe UI Symbol',serif">{ACC_GLYPH[acc]}</text>
        )}
        {ledgerLines.map((l) => {
          const lg = l + offset; // 加线局部步 → 全局步（中央 C 两谱共全局 10）
          return (
            <line key={l} className="ledger" x1={LEDGER_X1} x2={LEDGER_X2} y1={stepY(lg)} y2={stepY(lg)}
              stroke="#cbd5e1" strokeWidth={1.5} />
          );
        })}
        <ellipse className="note-head" cx={NOTE_X} cy={cy} rx={RX} ry={RY} fill="#f8fafc"
          transform={`rotate(-20 ${NOTE_X} ${cy})`} />
        <line x1={NOTE_X + 8} x2={NOTE_X + 12} y1={cy - 3} y2={cy - 3 - STEM} stroke="#f8fafc" strokeWidth={2} />
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/ui/GrandStaffView.test.tsx --maxWorkers=1`
Expected: PASS（6 个用例全绿）。若测试断言里 `trebleYs` 顺序笔误导致失败，比对 Step 1 中注释（全局步 12..20 与 0..8 各 5 线），修正后复跑——**不要**为迁就断言去改组件几何常量。

- [ ] **Step 5: 类型门禁**

Run: `npx tsc -b`
Expected: exit 0。

- [ ] **Step 6: Commit**

```bash
git add sightflash/src/ui/GrandStaffView.tsx sightflash/src/ui/GrandStaffView.test.tsx
git commit -m "feat(sightflash): GrandStaffView 组件——双行五线+大括号+双谱号连续轴（§25）
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: PracticeScreen 混合模式分支 + seed 测试缝 + 集成测试

**Files:**
- Modify: `sightflash/src/ui/PracticeScreen.tsx`（import + 分支 + 表头文案）
- Modify: `sightflash/src/app/state.tsx`（可选 `seed` prop，测试缝，仅 memory 生效）
- Modify: `sightflash/src/app/App.tsx`（透传 seed）
- Modify: `sightflash/src/app/App.test.tsx`（新集成用例）

> **为什么需要 seed 缝：** 混合谱要 `stage≥3` 才解锁，现有黑盒路径（AppRoot repoKind=memory）初始 stage=1，且无 UI 途径快进。加一个**可选** `seed`（仅影响初始 state，不带入产品默认行为；自动路径仍走 IndexedDB 首次载入覆盖）让集成测试能直达 stage 3 + mixed，验证「混合渲染 grand、单谱仍单行」。A1 同类兼容设计先例：`gamut?` 可选参数 + `?? 'natural'`。

- [ ] **Step 1: 写失败集成测试** — 先在 `sightflash/src/app/App.test.tsx` 末尾 describe 内新增两个用例

在现有 `afterEach` 之前追加（注意文件末尾结构）：

```tsx
  it('seed stage3+mixed：混合模式练习渲染大谱表且表头标“大谱表”', async () => {
    render(<AppRoot repoKind="memory" seed={{ stage: 3, lastClef: 'mixed' }} />);
    await screen.findByText(/五线速读/);
    await userEvent.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择谱号/);
    await userEvent.click(screen.getByRole('button', { name: /高\/低混合/ }));
    expect(await screen.findByTestId('grand-staff')).toBeInTheDocument();
    expect(screen.queryByTestId('staff')).toBeNull(); // 混合不再走单行谱
    expect(screen.getByText(/大谱表/)).toBeInTheDocument(); // 表头
  });

  it('seed stage1+treble：单谱模式仍渲染单行 StaffView（分支不串扰）', async () => {
    render(<AppRoot repoKind="memory" seed={{ stage: 1, lastClef: 'treble' }} />);
    await screen.findByText(/五线速读/);
    await userEvent.click(screen.getByRole('button', { name: /开始训练/ }));
    await screen.findByText(/选择谱号/);
    await userEvent.click(screen.getByRole('button', { name: /高音谱/ }));
    expect(await screen.findByTestId('staff')).toBeInTheDocument();
    expect(screen.queryByTestId('grand-staff')).toBeNull();
    expect(screen.getByText(/高音谱/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/app/App.test.tsx --maxWorkers=1`
Expected: FAIL——`AppRoot` 尚不接受 `seed` prop：TS 报未声明（类型红）；即便 esbuild 忽略类型直接跑，seed 未生效 → stage 仍 1 → 「高/低混合」按钮 disabled、点了不跳 practice → `findByTestId('grand-staff')` 超时（运行红）。两种红均计为通过。

- [ ] **Step 3: state.tsx 加可选 seed（向后兼容）**

`state.tsx` 顶部 import 块补类型 import；新增导出类型与 `seededState`；`makeRepo`/`AppProvider` 加可选参。

改 import（文件第 1-5 行区）：
```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState } from '../core/storage/types';
import type { SightRepo } from '../core/storage/memory';
import { MemoryRepo } from '../core/storage/memory';
import { IdbRepo, initialState } from './indexeddb';
import type { MixedClef, Gamut } from '../core/generator/stages';
```

`makeRepo` 改为接受初始 state（替换原第 27-33 行整块）：
```tsx
export function makeRepo(repoKind?: 'memory' | 'auto', init: AppState = initialState()): SightRepo {
  if (repoKind === 'memory') return new MemoryRepo(init);
  try {
    if (typeof indexedDB !== 'undefined') return new IdbRepo();
  } catch { /* ignore */ }
  return new MemoryRepo(init);
}
```

在 `export type View` 附近新增（第 8 行后）：
```tsx
/** 测试缝：以 AppRoot/AppProvider 的 seed 覆盖初始 progress.stage 与 settings.lastClef/gamut。
 *  缺省 = initialState()，与产品行为完全一致；自动路径仍以 IndexedDB 首次载入为准。 */
export interface SeedState {
  stage?: number;
  lastClef?: MixedClef;
  gamut?: Gamut;
}

export function seededState(seed?: SeedState): AppState {
  const def = initialState();
  if (!seed) return def;
  return {
    ...def,
    progress: { ...def.progress, stage: seed.stage ?? def.progress.stage },
    settings: {
      ...def.settings,
      lastClef: seed.lastClef ?? def.settings.lastClef,
      gamut: seed.gamut ?? def.settings.gamut,
    },
  };
}
```

`AppProvider` 签名与内部两处初始（替换原第 35-39 行）：
```tsx
export function AppProvider({ repoKind, seed, children }: {
  repoKind?: 'memory' | 'auto';
  seed?: SeedState;
  children: ReactNode;
}) {
  const [repo, setRepo] = useState<SightRepo>(() => makeRepo(repoKind, seededState(seed)));
  const [state, setState] = useState<AppState>(() => seededState(seed));
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('home');
```
（其余 useEffect 与 store 组装不动。）

- [ ] **Step 4: App.tsx 透传 seed**

`App.tsx` 的 `AppRoot`（替换第 9-15 行）：
```tsx
export function AppRoot({ repoKind, seed }: { repoKind?: 'memory' | 'auto'; seed?: SeedState }) {
  return (
    <AppProvider repoKind={repoKind} seed={seed}>
      <Shell />
    </AppProvider>
  );
}
```
import 行补 `import type { SeedState } from './state';`（第 1 行后）。

- [ ] **Step 5: PracticeScreen 分支 + 表头**

`sightflash/src/ui/PracticeScreen.tsx`：
- 第 9 行后加 import：`import { GrandStaffView } from './GrandStaffView';`
- 替换表头（第 106 行）区块中的 `clefName` 定义与渲染：把第 98 行 `const clefName = ...` 改为
```tsx
  const clefName = cfg.clef === 'mixed' ? '大谱表' : sess.target.clef === 'treble' ? '高音谱' : '低音谱';
```
- 替换第 109 行谱面渲染为分支：
```tsx
      {cfg.clef === 'mixed' ? (
        <GrandStaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />
      ) : (
        <StaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />
      )}
```
（`cfg.clef` 来自 `settings.lastClef`，类型 `MixedClef`；`sess.target.clef` 恒为单谱 `Clef`，见计划头备忘。）

- [ ] **Step 6: 运行确认通过（含既有回归）**

Run: `npx vitest run src/app/App.test.tsx src/ui/GrandStaffView.test.tsx --maxWorkers=1`
Expected: PASS——新增 2 个 + 既有 8 个 App 用例全绿（既有「高音谱 → findByTestId('staff')」用例即证明单谱分支未回归）。

- [ ] **Step 7: 全量回归 + 类型门禁**

Run: `npx vitest run --maxWorkers=1`
Expected: 全绿（截至 A1 为 82+ 用例，本任务增 2+）。
Run: `npx tsc -b`
Expected: exit 0。

- [ ] **Step 8: Commit**

```bash
git add sightflash/src/app/App.tsx sightflash/src/app/state.tsx sightflash/src/app/App.test.tsx sightflash/src/ui/PracticeScreen.tsx
git commit -m "feat(sightflash): 混合模式渲染大谱表 GrandStaffView + seed 测试缝（§25）
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 大谱表版式 CSS（横屏一屏预算 + 竖屏）

**Files:**
- Modify: `sightflash/src/index.css`

测试无法在 jsdom 断言布局（无真实布局引擎）——CSS 回归靠 vitest 全量绿 + `tsc -b` + build；观感靠真机。**不要为此任务改任何单测。**

- [ ] **Step 1: 加竖屏与横屏规则**

在 `@media (orientation: landscape)` 块的 `.practice .note-keys.chromatic .note-btn { ... }` 行（第 83 行）之后、`.practice .piano {` 之前插入，并保留 §22.1 式真机微调注释：

```css
  /* 大谱表（A2 §25.3，混合模式）：高度驱动缩放——svg 无内联宽高、viewBox 320/240 等比。
     横屏高度随视口 clamp（360→~150 / 375→~161 / 430→~185），宽度按纵横比自动 ≈133%×高。
     真机微调优先：此 clamp 值、Task 1 GrandStaffView 的 SPACE/ANCHOR_TOP/TREBLE_OFFSET，
     以及下方竖屏 max-width。固定件合计≈86 + 谱面≈150 + 键盘≥108 ≈ 366（最紧档 360 恰好）。 */
  .practice .grand-staff { flex: none; margin: 0 auto; }
  .practice .grand-staff svg { width: auto; height: clamp(150px, 43dvh, 186px); }
```

在文件较靠前、`.staff-wrap`（第 31 行）之后补竖屏/一般规则（`.grand-staff` 竖屏限宽，同 StaffView 老例）：
```css
/* 大谱表容器（A2，混合模式） */
.grand-staff { text-align: center; margin: 4px auto; }
.grand-staff svg { display: block; margin: 0 auto; width: 100%; max-width: 250px; height: auto; }
```

- [ ] **Step 2: 确认不影响单行谱横屏**

Run: `npx vitest run --maxWorkers=1`
Expected: 全绿（CSS 无单测，此步只为回归快照）。
Run: `npx tsc -b` → exit 0；`npm run build` → 成功。

- [ ] **Step 3: Commit**

```bash
git add sightflash/src/index.css
git commit -m "style(sightflash): 大谱表版式——横屏高度 clamp 一屏预算 + 竖屏限宽（§25）
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: README 里程碑 A 说明与验收项

**Files:**
- Modify: `sightflash/README.md`

- [ ] **Step 1: 更新「提示」段（第 7 行）**

在段末（`设置页可开「练黑键（变化音）」…12 键（黑键键双名标注）。` 之后）追加一句：

```
混合模式（高/低混合）谱面为真钢琴大谱表：双行五线 + 贯通大括号 + 高/低音谱号同屏，单音画在所属那一行；高/低音单谱模式仍为单行谱。
```

- [ ] **Step 2: 更新验收清单**

替换第 25 行混合模式验收项为：
```
- [ ] 混合模式（S3 后）：谱面为真钢琴大谱表（双行五线+贯通大括号+高低双谱号同屏），单音画在所属行、另一行只示空谱
```
并在第 30 行（横屏整屏验收项）之后加一项：
```
- [ ] 混合模式 360 横屏：大谱表可读、双谱号/大括号清晰、键盘仍完整无纵向滚动
```

- [ ] **Step 3: 全量门禁**

Run: `npx vitest run --maxWorkers=1` → 全绿；`npx tsc -b` → exit 0。

- [ ] **Step 4: Commit**

```bash
git add sightflash/README.md
git commit -m "docs(sightflash): README 同步大谱表（混合模式）说明与真机验收项（§25）
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Self-Review（对照 §25）

- **§25.1 范围**：GrandStaffView 新组件 ✓（Task 1）；PracticeScreen `cfg.clef==='mixed'` 分支、单谱仍单行 ✓（Task 2 Step 5 + App 既有回归用例）；出题/判题/音名板/琴键零改动 ✓（全程未触碰 stages/generator/session/NoteButton/Piano）。
- **§25.2 几何**：连续轴偏移 12 + 复用 layoutStaffNote ✓（Task 1 常量 `TREBLE_OFFSET` 与 ledger 偏移）；双谱号/大括号 ✓；acc 记号复用 letterMidiOf ✓（测试 `C#4 锚 C4`）；`positions.ts`/`note.ts` 零改动 ✓。
- **§25.3 一屏预算**：横屏 `.grand-staff svg` 高度 `clamp(150px,43dvh,186px)` ✓（Task 3，附 360 档换算注释）。
- **§25.4 测试验收**：GrandStaffView 几何单测 ✓（Task 1，含低/高题落行、中央 C 同线、acc）；PracticeScreen 集成：混合 → grand、单谱 → staff ✓（Task 2，seed 直达 stage3）；回归 vitest+tsc+build ✓；README 说明与验收项 ✓（Task 4）；真机项列入 README 手动清单，CSS 观感留真机（与 §22 老例一致，测试不 mock 布局引擎）。

**已知权衡（真机微调，非本次缺陷）**：155px 显示高下双谱线距 ≈10-11px，小于单行谱的 ≈18px——是双谱 + 单音题面在固定预算下的几何下限，可调 `.grand-staff svg` clamp 或收紧固定件。已在代码注释与 README 标注。
