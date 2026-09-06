# SightFlash 主题系统（§26）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 SightFlash 现有「单一深色观感」升级为**四套可切换主题**（paper 暖纸乐稿=默认 / ebony 乌木暖夜 / ink 极简墨白 / classic 经典深色=现状逐值保底），全屏 + 谱面 SVG + 钢琴颜色收敛为 CSS 变量，设置页可选、持久化、首帧无闪变。

**Architecture:** 颜色全部收敛成 CSS 自定义属性（令牌）。主题挂 `<html data-theme="…">`：`:root` 放 **paper** 默认令牌，`html[data-theme="ebony|ink|classic"]` 三块覆盖。React 只负责把 `settings.theme`（IndexedDB 真源）同步到 `documentElement.dataset.theme`；`main.tsx` render 前用 localStorage 镜像同步设一次属性 → 首帧即正确底色。谱面 SVG 硬编码色改为引用 `var(--staff-*)`；几何/布局/横屏高度预算（§22.1/§25.3）**不动**。

**Tech Stack:** React 19 / TS strict / vitest(jsdom) / @testing-library / CSS 自定义属性。

**环境铁律（本项目特有，务必照做）：**
- 所有 vitest 运行加 `--maxWorkers=1`（低内存 worker 会崩 0xC0000409）。单文件：`npx vitest run <file> --maxWorkers=1`。
- 类型门禁 = `npx tsc -b`（`tsc --noEmit` 是空操作，别用）。
- Windows 大小写不敏感：组件导入须显式扩展名（`./Piano.tsx`）。
- git 在**仓库根** `d:/OneDrive/claude_project/cleaner` 操作，提交信息前缀 `sightflash`（实际写 `feat(sightflash): …` 等）；LF→CRLF warning 无害。
- 工作目录默认 `d:/OneDrive/claude_project/cleaner/sightflash`（npm 项目在此）。

---

## 文件结构

- **`src/core/storage/types.ts`**（改）：加 `ThemeId` 类型 + `DEFAULT_THEME` + `THEME_IDS`；`Settings` 加必填 `theme: ThemeId`。
- **`src/core/storage/logic.ts`**（改）：`defaultState()` 的 settings 加 `theme: DEFAULT_THEME`（唯一 settings 构造点：新装/重置/内存兜底共用）。
- **`src/ui/themes.ts`**（新）：`THEMES`（id+中文名，顺序 paper/ebony/ink/classic）、`normalizeTheme(v): ThemeId`（非法/缺省回落 DEFAULT_THEME）、`applyBootTheme(): ThemeId`（读 localStorage 镜像设 dataset）、`mirrorTheme(t)`（写镜像）。localStorage 键 `LS_THEME='sf:theme'`。
- **`src/ui/themes.test.ts`**（新）：单元覆盖 defaultState/normalize/THEMES。
- **`src/app/App.tsx`**（改）：Provider 内加 `ThemeSync`（useApp→effect 同步 dataset+镜像）。
- **`src/main.tsx`**（改）：render 前调 `applyBootTheme()`。
- **`src/ui/SettingsScreen.tsx`**（改）：「主题」行（4 枚小按钮，当前项 ` ✓`）。
- **`src/index.css`**（改，Task 3 全量重写）：布局规则**原样**；颜色字面量 → `var(--token)`；`:root`=paper 令牌 + 三个 `html[data-theme]` 覆盖块。
- **`src/ui/StaffView.tsx` / `GrandStaffView.tsx` / `StatsScreen.tsx`**（改）：谱面/图表色字面量 → CSS 变量。
- **`sightflash/README.md`**（改）：设置可切四主题说明。

---

### Task 1: 主题数据层（类型 / 默认 / 归一化）

**Files:**
- Modify: `src/core/storage/types.ts`（Settings + 新导出）
- Modify: `src/core/storage/logic.ts:1-12`
- Create: `src/ui/themes.ts`
- Test: `src/ui/themes.test.ts`

- [ ] **Step 1: 写失败测试**（此时 `theme`/`normalizeTheme` 不存在 → 编译红）

`src/ui/themes.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import { defaultState } from '../core/storage/logic';
import { DEFAULT_THEME } from '../core/storage/types';
import { normalizeTheme, THEMES } from './themes';

describe('主题数据层', () => {
  it('默认状态 theme = paper', () => {
    expect(defaultState().settings.theme).toBe('paper');
    expect(DEFAULT_THEME).toBe('paper');
  });

  it('THEMES 含四套且 paper 为首', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['paper', 'ebony', 'ink', 'classic']);
    expect(new Set(THEMES.map((t) => t.label)).size).toBe(4); // 名不重复
  });

  it('normalizeTheme：合法原样、非法/缺省回落 paper', () => {
    expect(normalizeTheme('ebony')).toBe('ebony');
    expect(normalizeTheme('classic')).toBe('classic');
    expect(normalizeTheme(undefined)).toBe('paper');
    expect(normalizeTheme('neon')).toBe('paper');
    expect(normalizeTheme(null)).toBe('paper');
    expect(normalizeTheme(42)).toBe('paper');
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run（在 `sightflash/`）：`npx vitest run src/ui/themes.test.ts --maxWorkers=1`
Expected: FAIL（编译错：`theme` 属性不存在 / 找不到 `./themes`）。

- [ ] **Step 3: 实现数据层**

`src/core/storage/types.ts` —— 顶部 type 区加：
```ts
/** 主题 id：paper 暖纸乐稿（默认）/ ebony 乌木暖夜 / ink 极简墨白 / classic 经典深色 */
export type ThemeId = 'paper' | 'ebony' | 'ink' | 'classic';
export const DEFAULT_THEME: ThemeId = 'paper';
export const THEME_IDS: readonly ThemeId[] = ['paper', 'ebony', 'ink', 'classic'] as const;
```
`Settings` 接口在 `gamut` 行后加一行：
```ts
  gamut: Gamut; // 练黑键（变化音）全局开关
  theme: ThemeId; // 主题（§26）：paper|ebony|ink|classic，缺省回落 DEFAULT_THEME
```

`src/core/storage/logic.ts` —— 把第 1 行拆成 value + type 两行导入：
```ts
import { DEFAULT_THEME } from './types';
import type { AppState, Progress, Streak, Daily } from './types';
```
`defaultState()` 的 settings 字面量在 `gamut` 后加：
```ts
    settings: { sound: true, durationSec: 60, lastMode: 'tap', lastClef: 'treble', gamut: 'natural', theme: DEFAULT_THEME },
```

`src/ui/themes.ts`（新建）：
```ts
import { DEFAULT_THEME, THEME_IDS } from '../core/storage/types';
import type { ThemeId } from '../core/storage/types';

/** localStorage 首帧镜像键：非真源，真源 = settings(IndexedDB)。仅避免首帧底色闪变。 */
export const LS_THEME = 'sf:theme';

export interface ThemeOption { id: ThemeId; label: string; }

/** 主题顺序即设置页展示顺序；首项 = 默认（暖纸乐稿）。 */
export const THEMES: ThemeOption[] = [
  { id: 'paper', label: '暖纸乐稿' },
  { id: 'ebony', label: '乌木暖夜' },
  { id: 'ink', label: '极简墨白' },
  { id: 'classic', label: '经典深色' },
];

/** 任意值 → 合法主题；非法/空 → DEFAULT_THEME('paper')。老存档缺 theme 字段走这里回落。 */
export function normalizeTheme(v: unknown): ThemeId {
  return (THEME_IDS as readonly string[]).includes(v as string) ? (v as ThemeId) : DEFAULT_THEME;
}

/** main.tsx render 前调用：读 localStorage 镜像设 <html data-theme>，保证首帧即正确底色。返回实际主题。 */
export function applyBootTheme(): ThemeId {
  let t: ThemeId = DEFAULT_THEME;
  try {
    const s = localStorage.getItem(LS_THEME);
    if (s) t = normalizeTheme(s);
  } catch { /* 隐私/禁用时忽略，用默认 */ }
  document.documentElement.dataset.theme = t;
  return t;
}

/** 主题变化后写镜像（只在实际不同时写，减少噪声）。 */
export function mirrorTheme(t: ThemeId): void {
  try {
    if (localStorage.getItem(LS_THEME) !== t) localStorage.setItem(LS_THEME, t);
  } catch { /* ignore */ }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run：`npx vitest run src/ui/themes.test.ts --maxWorkers=1`
Expected: PASS（3 项全绿）。

- [ ] **Step 5: 类型门禁**

Run（在 `sightflash/`）：`npx tsc -b`
Expected: exit 0。

- [ ] **Step 6: Commit**

```bash
git -C d:/OneDrive/claude_project/cleaner add sightflash/src/core/storage/types.ts sightflash/src/core/storage/logic.ts sightflash/src/ui/themes.ts sightflash/src/ui/themes.test.ts
git -C d:/OneDrive/claude_project/cleaner commit -m "feat(sightflash): 主题数据层——ThemeId/DEFAULT_THEME/defaultState+normalize（§26）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 主题切换生效（App 同步 + 设置页行 + 首帧 boot）

**Files:**
- Modify: `src/app/App.tsx`（Provider 内加 `ThemeSync`）
- Modify: `src/main.tsx`（render 前 `applyBootTheme()`）
- Modify: `src/ui/SettingsScreen.tsx`（主题行）
- Test: `src/app/App.test.tsx`（加 2 个用例）

**背景**：`AppProvider`（state.tsx）已保证 `setState` 后全量 `saveState` 持久化、首次 `loadState` 后 `setState`。主题只需：任何 settings.theme 变化 → 同步 `documentElement.dataset.theme` + `mirrorTheme`。

- [ ] **Step 1: 写失败测试**（加进 `src/app/App.test.tsx`，放在现有用例之后、`afterEach` 之前）

```tsx
  it('主题同步：默认挂载后 <html> data-theme=paper，且设置页可切到 ebony', async () => {
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    expect(document.documentElement.dataset.theme).toBe('paper');
    await userEvent.click(screen.getByRole('button', { name: /设置/ }));
    await screen.findByText(/清除本地数据/);
    await userEvent.click(screen.getByRole('button', { name: /乌木暖夜/ }));
    expect(document.documentElement.dataset.theme).toBe('ebony');
    expect(localStorage.getItem('sf:theme')).toBe('ebony');
  });

  it('非法主题值回落 paper（老档防御：normalize 兜底）', async () => {
    document.documentElement.dataset.theme = 'neon'; // 模拟脏值
    render(<AppRoot repoKind="memory" />);
    await screen.findByText(/五线速读/);
    expect(document.documentElement.dataset.theme).toBe('paper');
  });
```
（若现有 `afterEach` 需清 dataset 防串扰：在其回调里加一行 `delete document.documentElement.dataset.theme;`。）

- [ ] **Step 2: 跑测试确认红**

Run：`npx vitest run src/app/App.test.tsx --maxWorkers=1`
Expected: FAIL（未实现：dataset.theme 空 / 无「乌木暖夜」按钮）。

- [ ] **Step 3: 实现**

`src/app/App.tsx` —— import 加：
```tsx
import { useEffect } from 'react';
import { normalizeTheme, mirrorTheme } from '../ui/themes';
```
`AppRoot` 的 JSX 里、`<Shell/>` 旁加 `<ThemeSync />`：
```tsx
  return (
    <AppProvider repoKind={repoKind} seed={seed}>
      <Shell />
      <ThemeSync />
    </AppProvider>
  );
```
文件底部（`Shell` 后）加：
```tsx
/** 主题同步：settings.theme（真源）→ <html data-theme> + localStorage 首帧镜像。
 *  mount 即设一次（含老档缺字段回落的 paper），后续仅 theme 变化时重设。 */
function ThemeSync() {
  const { state } = useApp();
  const theme = normalizeTheme(state.settings.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    mirrorTheme(theme);
  }, [theme]);
  return null;
}
```

`src/main.tsx` —— import 加 `applyBootTheme`，render 前调用：
```tsx
import './index.css';
import App from './app/App';
import { applyBootTheme } from './ui/themes';

applyBootTheme(); // 首帧底色（JS 先于首帧 → 无闪变）

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/ui/SettingsScreen.tsx` —— import 加：
```tsx
import { THEMES } from './themes';
```
在「每轮时长」行之后、「清除本地数据」之前插入主题行：
```tsx
        <div className="row"><span>主题</span>
          {THEMES.map((t) => (
            <button key={t.id} className="sel small" data-testid={`theme-${t.id}`}
              onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, theme: t.id } }))}>
              {t.label}{state.settings.theme === t.id ? ' ✓' : ''}
            </button>
          ))}
        </div>
```

- [ ] **Step 4: 跑测试确认通过**

Run：`npx vitest run src/app/App.test.tsx --maxWorkers=1`
Expected: PASS（含新增 2 项，原有用例不回归）。

- [ ] **Step 5: 类型门禁**

Run：`npx tsc -b` → exit 0。

- [ ] **Step 6: Commit**

```bash
git -C d:/OneDrive/claude_project/cleaner add sightflash/src/app/App.tsx sightflash/src/main.tsx sightflash/src/ui/SettingsScreen.tsx sightflash/src/app/App.test.tsx
git -C d:/OneDrive/claude_project/cleaner commit -m "feat(sightflash): 主题切换生效——App 同步 <html data-theme>+镜像、main 首帧 boot、设置页主题行（§26）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 令牌化 CSS + 谱面/图表色改变量（视觉主体，全量重写 index.css）

**Files:**
- Rewrite: `src/index.css`（布局规则逐条保留；颜色全换 `var(--…)`；`:root`=paper + 三覆盖块）
- Modify: `src/ui/StaffView.tsx`（谱号/线/记号/符头/符干/加线 fill/stroke → `var(--staff-*)`）
- Modify: `src/ui/GrandStaffView.tsx`（同上）
- Modify: `src/ui/StatsScreen.tsx`（chart 圆点 `fill="#38bdf8"` → `style={{ fill: 'var(--accent)' }}`）
- Gate: 既有全部测试 + `tsc -b` + build

> 说明：CSS 无单测（jsdom 无布局引擎，项目既定事实）。本任务"红→绿"以**既有测试不回归 + tsc + build** 为验收；SVG 无 fill/stroke 颜色断言（已核实）。真机观感最后 Task 4 收。

- [ ] **Step 1: 重写 `src/index.css`**

用下面的**完整文件**替换（布局/媒体查询结构一字未动，颜色全部经令牌）：

```css
/* ===== 主题令牌（§26）=====
   :root = paper 暖纸乐稿（默认）；html[data-theme=ebony|ink|classic] 覆盖。
   谱面令牌 --staff-* 同时驱动 StaffView 与 GrandStaffView；classic 逐值=改前观感。 */
:root {
  /* 谱面 */
  --staff-line: rgba(42, 34, 24, .42);   /* 五线 */
  --staff-soft: rgba(42, 34, 24, .78);   /* 谱号 / 加线 / 括号 */
  --staff-note: #241d13;                 /* 符头 / 符干 / ♯♭ 记号 */

  /* 琴键（象牙白与乌木黑四套一致；壳随主题） */
  --key-case: #e9dfc8;
  --key-w-hi: #fdfaf2;   --key-w-lo: #e9dfc6;   --key-w-bd: #c9bda0;   --key-w-act: #cfc2a6;
  --key-b-hi: #3a3026;   --key-b-lo: #141009;   --key-b-act: #4a3e31;  --key-b-bd: #000;
  --c4-label: #9a6116;

  /* 通用 */
  --bg: #f6f0e2; --bg-card: #fdf9ee; --card-bd: #e0d5ba; --plot: #ece3cc;
  --text: #2a2218; --text-dim: #7a6c55; --text-faint: #a2947c;
  --line: #e3d8bb; --line-strong: #cfc3a3; --track: rgba(42, 34, 24, .13);
  --accent: #b8432f; --accent-contrast: #fff9ef;
  --ok: #3f7d53; --bad: #b3261e;
  --ctrl-bg: #f6efdd; --ctrl-hover: #efe6d0; --ctrl-active: #e6dabb;
  --danger-text: #b3261e; --danger-bd: #d9a9a6;
  --black-name: #a4680a; --black-name-bd: #cf9b3e;
  --font-display: Georgia, "Noto Serif SC", "Songti SC", "SimSun", serif;
}

html[data-theme="ebony"] {
  --staff-line: rgba(244, 234, 218, .34); --staff-soft: rgba(244, 234, 218, .82); --staff-note: #f6eddc;
  --key-case: #0f0b07;
  --key-w-hi: #fdfaf2; --key-w-lo: #e7ddc6; --key-w-bd: #b3a890; --key-w-act: #c9bda0;
  --key-b-hi: #241a11; --key-b-lo: #0a0603; --key-b-act: #37291a; --key-b-bd: #000;
  --c4-label: #b45309;
  --bg: #1a150f; --bg-card: #241c13; --card-bd: #3a2f20; --plot: #120d08;
  --text: #f4eada; --text-dim: #b3a488; --text-faint: #8a7c63;
  --line: #3a2f20; --line-strong: #4a3b29; --track: rgba(244, 234, 218, .14);
  --accent: #c9a35f; --accent-contrast: #1a1209;
  --ok: #9fd08c; --bad: #ef8f80;
  --ctrl-bg: #2b2318; --ctrl-hover: #362c1d; --ctrl-active: #413423;
  --danger-text: #eab3a1; --danger-bd: #7f3a2d;
  --black-name: #d9b36a; --black-name-bd: #8a5a00;
  --font-display: system-ui, -apple-system, "PingFang SC", sans-serif;
}

html[data-theme="ink"] {
  --staff-line: rgba(19, 19, 19, .38); --staff-soft: rgba(19, 19, 19, .8); --staff-note: #000;
  --key-case: #eceae4;
  --key-w-hi: #ffffff; --key-w-lo: #ecece7; --key-w-bd: #cfcfca; --key-w-act: #dcdcd6;
  --key-b-hi: #262626; --key-b-lo: #000; --key-b-act: #3b3b3b; --key-b-bd: #000;
  --c4-label: #555;
  --bg: #fcfcfb; --bg-card: #ffffff; --card-bd: #e4e4df; --plot: #f2f2ee;
  --text: #161616; --text-dim: #6f6f6a; --text-faint: #9a9a95;
  --line: #e4e4df; --line-strong: #d3d3cd; --track: rgba(0, 0, 0, .1);
  --accent: #161616; --accent-contrast: #ffffff;
  --ok: #2f6b46; --bad: #c0392b;
  --ctrl-bg: #ffffff; --ctrl-hover: #f4f4f0; --ctrl-active: #e9e9e4;
  --danger-text: #c0392b; --danger-bd: #e0d2d0;
  --black-name: #6b6b66; --black-name-bd: #d3d3cd;
  --font-display: Georgia, "Noto Serif SC", "Songti SC", "SimSun", serif;
}

html[data-theme="classic"] {
  /* 与改前观感逐值一致（slate 深色），仅收进令牌 */
  --staff-line: #64748b; --staff-soft: #cbd5e1; --staff-note: #f8fafc;
  --key-case: #0b1220;
  --key-w-hi: #f8fafc; --key-w-lo: #dbe3ea; --key-w-bd: #94a3b8; --key-w-act: #94a3b8;
  --key-b-hi: #1e293b; --key-b-lo: #0f172a; --key-b-act: #334155; --key-b-bd: #000;
  --c4-label: #b45309;
  --bg: #0f172a; --bg-card: #1e293b; --card-bd: transparent; --plot: #0b1220;
  --text: #e2e8f0; --text-dim: #94a3b8; --text-faint: #64748b;
  --line: #334155; --line-strong: #475569; --track: #334155;
  --accent: #38bdf8; --accent-contrast: #0f172a;
  --ok: #4ade80; --bad: #f87171;
  --ctrl-bg: #1e293b; --ctrl-hover: #293548; --ctrl-active: #334155;
  --danger-text: #fca5a5; --danger-bd: #7f1d1d;
  --black-name: #fbbf24; --black-name-bd: #8a5a00;
  --font-display: system-ui, -apple-system, "PingFang SC", sans-serif;
}

* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; }
#root { max-width: 640px; margin: 0 auto; min-height: 100dvh; }
.screen { padding: 16px; }
h1 { font-size: 1.6rem; margin: 4px 0 12px; font-family: var(--font-display); }
.card { background: var(--bg-card); border-radius: 12px; padding: 16px; margin: 12px 0; border: 1px solid var(--card-bd); }
.boot { padding: 40px; text-align: center; color: var(--text-dim); }
.bar { height: 8px; background: var(--track); border-radius: 4px; overflow: hidden; margin: 8px 0; }
.bar-fill { height: 100%; background: var(--accent); transition: width .3s; }
.row { display: flex; gap: 8px; justify-content: center; align-items: center; }
.row.space-between { justify-content: space-between; }
button { font: inherit; }
button.primary { background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: 10px; padding: 12px 20px; font-size: 1.1rem; }
button.big { width: 100%; padding: 16px; font-size: 1.2rem; margin: 8px 0; }
button.sel, button.ghost, button.danger { background: var(--ctrl-bg); color: var(--text); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; margin: 6px; }
button.sel:disabled { opacity: .4; }
button.sel.small { padding: 6px 12px; }
button.danger { color: var(--danger-text); border-color: var(--danger-bd); }
.note-btn { flex: 1; min-width: 0; aspect-ratio: 1; font-size: 1.35rem; border-radius: 12px; border: 1px solid var(--line); background: var(--ctrl-bg); color: var(--text); }
/* 12 键音名板（练黑键=chromatic）：黑键键颜色随主题（双名标注） */
.note-keys.chromatic { flex-wrap: wrap; row-gap: 6px; }
.note-keys.chromatic .note-btn { flex: 1 1 36px; min-width: 0; max-width: 46px; font-size: 0.72rem; padding: 0 2px; }
.note-btn.black-name { color: var(--black-name); border-color: var(--black-name-bd); }
.label { color: var(--text-dim); margin-bottom: 6px; }
.small { color: var(--text-faint); font-size: .85rem; }
.timer { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
.timer.warn { color: var(--bad); }
.fb { min-height: 28px; text-align: center; font-size: 1.1rem; margin: 8px 0; }
.fb.ok { color: var(--ok); }
.fb.bad { color: var(--bad); }
.staff-wrap { text-align: center; margin: 4px 0; }
/* 大谱表容器（A2，混合模式） */
.grand-staff { text-align: center; margin: 4px auto; }
.grand-staff svg { display: block; margin: 0 auto; width: 100%; max-width: 250px; height: auto; }
.chart { width: 100%; height: 100px; background: var(--plot); border-radius: 8px; }
.err-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.err-row .bar { flex: 1; margin: 0; }
.bar-fill.warn { background: var(--bad); }
.danger { margin-top: 16px; }
/* 仿真钢琴键盘 */
.practice .staff-wrap svg { max-width: 250px; }
.piano { position: relative; display: flex; width: 100%; max-width: 480px; height: 150px;
  margin: 10px auto 2px; border-radius: 6px; overflow: hidden; background: var(--key-case);
  touch-action: none; user-select: none; }
.piano .key.white { position: relative; flex: 1 1 0; background: linear-gradient(var(--key-w-hi), var(--key-w-lo));
  border-right: 1px solid var(--key-w-bd); border-radius: 0 0 4px 4px; }
.piano .key.white:active { background: var(--key-w-act); }
.piano .key.black { position: absolute; top: 0; height: 62%; z-index: 1;
  background: linear-gradient(var(--key-b-hi), var(--key-b-lo)); border: 1px solid var(--key-b-bd);
  border-radius: 0 0 3px 3px; }
.piano .key.black:active { background: var(--key-b-act); }
/* 中央C(C4) 唯一文字标注：白键下缘小字，避开其上黑键区（黑键高 62%）。字色随主题、对照白键浅底 */
.piano .key.white .c4 { position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%);
  font-size: clamp(8px, 1.4vw, 12px); line-height: 1; font-weight: 600; color: var(--c4-label);
  pointer-events: none; user-select: none; }
/* 竖屏提示（可点击）：仅竖屏显示，横屏自动隐藏 */
.rotate-hint { display: flex; align-items: center; justify-content: center; gap: 8px;
  margin: 0 auto 10px; max-width: 480px; background: var(--ctrl-bg); color: var(--text-dim);
  font-size: .85rem; border: 1px solid var(--line-strong); border-radius: 8px; padding: 6px 10px;
  cursor: pointer; }
.rotate-hint:hover { background: var(--ctrl-hover); }
.rotate-hint:active { background: var(--ctrl-active); }

@media (orientation: landscape) {
  #root { max-width: 920px; }
  .rotate-hint { display: none; }

  /* 练习屏横屏：一屏放全、纵向不滚动。布局与高度预算（§22.1/§25.3）不变，仅颜色经令牌。 */
  .practice {
    height: 100dvh;
    padding: 4px 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    gap: 2px;
  }
  .practice .row { flex: none; }
  .practice .row.space-between { font-size: 0.9rem; }
  .practice .staff-wrap { max-width: 180px; margin: 0 auto; flex: none; }
  .practice .fb { min-height: 18px; margin: 0; font-size: 1rem; flex: none; }
  .practice .note-btn { max-width: 64px; aspect-ratio: auto; height: 32px; font-size: 1.1rem; border-radius: 8px; }
  .practice .note-keys.chromatic .note-btn { font-size: 0.95rem; max-width: 64px; }
  .practice .grand-staff { flex: none; margin: 0 auto; }
  .practice .grand-staff svg { width: auto; max-width: none; height: clamp(150px, 43dvh, 186px); }
  .practice .piano {
    flex: 1 1 0;
    min-height: 108px;
    max-height: 46dvh;
    height: auto;
    width: 100%;
    max-width: 920px;
    margin: 2px auto 0;
  }
}
```

- [ ] **Step 2: SVG/图表色改变量**

`src/ui/StaffView.tsx` 颜色属性改 CSS 变量（几何/坐标/字号全不动）。只改 5 处 fill/stroke：把 `fill="#cbd5e1"`（谱号）改 `style={{ fill: 'var(--staff-soft)' }}`、五线 `stroke="#64748b"` 改 `style={{ stroke: 'var(--staff-line)' }}`、记号 `fill="#f8fafc"`（accidental）改 `style={{ fill: 'var(--staff-note)' }}`、加线 `stroke="#cbd5e1"` 改 `style={{ stroke: 'var(--staff-soft)' }}`、符头 `fill="#f8fafc"` 与符干 `stroke="#f8fafc"` 改 `var(--staff-note)`。改后该组件关键三元素（前后对照，可整段替换）：

```tsx
        <text data-testid="clef" x={14} y={stepToY(clef === 'treble' ? 2 : 0) + 6} fontSize={52}
          style={{ fill: 'var(--staff-soft)' }} fontFamily="'Noto Music','Segoe UI Symbol',serif">
          {clefGlyph[clef]}
        </text>
        {LINES.map((l) => (
          <line key={l} className="staff-line" x1={60} x2={SVG_W - 16} y1={stepToY(l)} y2={stepToY(l)}
            style={{ stroke: 'var(--staff-line)' }} strokeWidth={1.5} />
        ))}
        {acc != null && (
          <text data-testid="accidental" x={182} y={cy + 8} textAnchor="end" fontSize={30}
            style={{ fill: 'var(--staff-note)' }} fontFamily="'Noto Music','Segoe UI Symbol',serif">
            {ACC_GLYPH[acc]}
          </text>
        )}
        {ledgerLines.map((l) => (
          <line key={l} className="ledger" x1={186} x2={246} y1={stepToY(l)} y2={stepToY(l)}
            style={{ stroke: 'var(--staff-soft)' }} strokeWidth={1.5} />
        ))}
        <ellipse className="note-head" cx={216} cy={cy} rx={10} ry={8} style={{ fill: 'var(--staff-note)' }}
          transform={`rotate(-20 216 ${cy})`} />
        <line x1={224} x2={228} y1={cy - 4} y2={cy - 46} style={{ stroke: 'var(--staff-note)' }} strokeWidth={2.5} />
```

`src/ui/GrandStaffView.tsx` 同法：五线 `stroke="#64748b"` → `var(--staff-line)`；大括号/双谱号/加线 `#cbd5e1` → `var(--staff-soft)`；记号/符头/符干 `#f8fafc` → `var(--staff-note)`。用 `style={{ fill/stroke: 'var(--…)' }}`，几何与 testid 不动。

`src/ui/StatsScreen.tsx`：散点圆 `fill="#38bdf8"` → `style={{ fill: 'var(--accent)' }}`（保留 cx/cy/r 属性）。

- [ ] **Step 3: 既有测试全量回归**

Run：`npx vitest run --maxWorkers=1`（在 `sightflash/`）
Expected: 全绿（几何断言不涉颜色，应零改动通过）。

- [ ] **Step 4: 类型 + 构建门禁**

Run：`npx tsc -b` → exit 0；`npm run build` → success。

- [ ] **Step 5: Commit**

```bash
git -C d:/OneDrive/claude_project/cleaner add sightflash/src/index.css sightflash/src/ui/StaffView.tsx sightflash/src/ui/GrandStaffView.tsx sightflash/src/ui/StatsScreen.tsx
git -C d:/OneDrive/claude_project/cleaner commit -m "style(sightflash): 令牌化——颜色全走 CSS 变量 + 四主题块（paper 默认/ebony/ink/classic）+ 谱面 SVG 反色（§26）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: README + 终审门禁

**Files:**
- Modify: `sightflash/README.md`

- [ ] **Step 1: README 同步**

在设置相关说明处补一段（措辞贴合现有风格）：
```md
- **主题**：设置页可切换四套皮肤——暖纸乐稿（默认，米白谱纸 + 墨色，谱面随主题反色）/ 乌木暖夜 / 极简墨白 / 经典深色。选择即时生效并记住；谱面与琴键颜色随主题自动适配。
```

- [ ] **Step 2: 全量门禁**

Run（在 `sightflash/`）：`npx vitest run --maxWorkers=1` → 全绿；`npx tsc -b` → 0；`npm run build` → success。

- [ ] **Step 3: Commit**

```bash
git -C d:/OneDrive/claude_project/cleaner add sightflash/README.md
git -C d:/OneDrive/claude_project/cleaner commit -m "docs(sightflash): README 同步主题系统（§26 四皮肤说明）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

- [ ] **Step 4: 交付说明**

列出 4 个 commit、验证结果（vitest/tsc/build），注明真机验收项（四主题逐套过各屏，浅色重点看谱墨/琴键；classic 与改前逐屏一致）。
