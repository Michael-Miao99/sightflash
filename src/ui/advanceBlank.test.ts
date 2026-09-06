import { describe, it, expect } from 'vitest';
import { AdvanceBlank, ADVANCE_BLANK_MS } from './advanceBlank';

describe('AdvanceBlank 换题消隐窗（§27 补）', () => {
  it('默认构造用真实时钟：shield 前不 blank，shield 后 250ms 内 blanked', () => {
    const b = new AdvanceBlank();
    expect(b.blanked()).toBe(false);
    b.shield();
    expect(b.blanked()).toBe(true);
  });

  it('clock 注入：blank 窗精确 =ADVANCE_BLANK_MS，到点即放行', () => {
    let t = 0;
    const b = new AdvanceBlank(() => t);
    b.shield(); // t=0 时 shield
    t += ADVANCE_BLANK_MS - 1;
    expect(b.blanked()).toBe(true); // 249ms：仍在窗内（旧音尾，丢弃）
    t += 1;
    expect(b.blanked()).toBe(false); // 250ms：到点放行（下一题首击可判）
  });

  it('重复 shield 重置窗起点（连对两题：窗随每次推进顺延）', () => {
    let t = 0;
    const b = new AdvanceBlank(() => t);
    b.shield();
    t += 100;
    b.shield(); // 100ms 时又推进一题
    t += 200; // 距最近 shield 200ms < 250ms → 仍 blank（吞上一题余音）
    expect(b.blanked()).toBe(true);
    t += 60; // 距最近 shield 260ms → 放行
    expect(b.blanked()).toBe(false);
  });

  it('不 shield 永不 blank（进练习屏首音直接判，不受历史影响）', () => {
    let t = 9999;
    const b = new AdvanceBlank(() => t);
    t += 5000;
    expect(b.blanked()).toBe(false);
  });
});
