# 横屏紧凑一屏布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机横屏下练习屏「上下间距过大、需纵向滚动」→ 改为 100dvh flex 一屏放全、纵向不滚动，键盘高度随屏高自适应。

**Architecture:** 纯 CSS 收敛横屏练习屏纵向空间：`.screen.practice` 在 `@media (orientation: landscape)` 内改 `height:100dvh; overflow:hidden` 的 flex 竖排，谱面/反馈/音名按钮固定为小高度，钢琴 `.piano` 以 `flex:1 1 0` 吸收剩余高度。不改 `StaffView` 几何（高音区符干向上极高，裁 svg 有削干风险）与任何 TS/出题逻辑。

**Tech Stack:** CSS（`src/index.css`）。竖屏与其余屏幕样式不变。规格依据：设计文档 §22。

**范围：** 只改 `sightflash/src/index.css` 最末一段 `@media (orientation: landscape)`（现含 `.practice .piano { height:185px }` 固定高度的那段）。纯 CSS 版式无法在 jsdom 断言真实布局，回归靠 vitest 全量绿 + `tsc -b` + `vite build`；真机验收走 README 手动清单。

---

### Task 1: 横屏练习屏紧凑一屏布局（index.css）

**Files:**
- Modify: `sightflash/src/index.css:57-63`（文件末尾的 `@media (orientation: landscape)` 块，现为）

```css
@media (orientation: landscape) {
  #root { max-width: 920px; }
  .rotate-hint { display: none; }
  .practice .staff-wrap svg { max-width: 210px; }
  .practice .note-btn { max-width: 64px; }
  .practice .piano { max-width: 920px; height: 185px; }
}
```

- [ ] **Step 1: 用下面的新媒体块整段替换旧块**

```css
@media (orientation: landscape) {
  #root { max-width: 920px; }
  .rotate-hint { display: none; }

  /* 练习屏横屏：一屏放全、纵向不滚动。谱面 svg 带内联 maxWidth:320（StaffView），
     样式表压不过它，故用 .staff-wrap 限宽 180 → svg(272/320 纵横比) ≈153 高。
     固定件合计 ≈255px，钢琴 flex:1 吸收剩余高度(360→~108 兜底 / 375→~120 / 430→~175)。
     真机微调优先：.staff-wrap 的 max-width、.note-btn 的 height、
     .piano 的 min/max-height、.practice 的 gap（见设计文档 §22.1 可调参数）。 */
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

> **执行演进记录（合入版为准）**：初版曾用 `.practice .staff-wrap svg { max-width:180px }` 直裁 svg，但 `StaffView` svg 内联 `max-width:320` 会压制样式表（死代码）→ 评审中发现，改为**裁父容器 `.staff-wrap`**（commit `ee052be`）；其后按 360 高视口（最紧档）实测把 `padding 6px→4px`、`gap 4px→2px` 收尾（commit `9a6a5f8`）。以本文档 CSS 块为准。
```

实现要点（评审对照）：
- `.screen` 基类竖屏 `padding:16px` 只会在竖屏生效；横屏下被此 `.practice` 规则覆盖（特异性相同、靠后）。
- `.rotate-hint` 仍 `display:none`（§21.1 不变）。
- 横屏 `.practice` 的 flex 子项：表头行、`.staff-wrap`、`.fb`、音名按钮 `.row`、`.piano`。`.row` 仍是横排 flex（基类 `display:flex` 不变），本块只补 `flex:none` 防止其被纵向拉伸。
- 钢琴内部白键是横向 flex、黑键是绝对定位 `height:62%`，其百分比高度依赖容器有确定高度——flex 项被分到确定高度即可解析（真实浏览器行为，勿在 jsdom 中试图断言）。
- 竖屏布局、其余屏幕（首页/设置/结算/数据）一律不动。

- [ ] **Step 2: 核对改动只落在该媒体块**

Run: `git diff --stat` 应只显示 `src/index.css`；`git diff` 确认没有触碰 `.piano { height: 150px }` 等竖屏基类规则。

- [ ] **Step 3: 全量测试**

Run: `npx vitest run` → 全绿（预期不变，本次无行为改动；应仍为 68 tests / 14 files 量级）。

- [ ] **Step 4: 类型门禁与构建**

Run: `npx tsc -b` → exit 0；`npm run build` → 成功产出 `dist/`（manifest 仍含 `"orientation":"landscape"`）。

- [ ] **Step 5: 提交**

```bash
git add src/index.css
git commit -m "feat(sightflash): 横屏练习屏一屏放全，键盘高度随屏自适应（§22）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

- [ ] **Step 6: 自评（向主会话报告）**
  - 确认横屏 `.practice` 有 `overflow:hidden`＋`height:100dvh`；固定件高度预算 ≈255、钢琴 `min-height:108`（360 高视口键盘底 < 360、完整可见不削底）。
  - 竖屏基类（`.piano{height:150px}`、`.note-btn{aspect-ratio:1}`、`.screen{padding:16px}`）未被改动。
  - 状态：DONE / DONE_WITH_CONCERNS / BLOCKED。

**验收（真机，后续由主会话交 boss 做，不在本任务自动判定）：** Android PWA 与 iOS Safari 横屏下练习屏整屏可见、无纵向滚动，键盘随屏高自适应；**验收须含一台视口高 ≈360px 的横屏设备**确认键盘完整可点。若真机有出入按 §22.1 可调参数微调。
