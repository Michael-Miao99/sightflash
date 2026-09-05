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
    expect(ledgerLinesOf(84, 'bass')).toEqual([10, 12, 14, 16, 18, 20, 22, 24]); // C6 在低音谱上方甚高（step24），加线直达该线位
  });

  it('layoutStaffNote 返回 step 与加线', () => {
    expect(layoutStaffNote(81, 'treble')).toEqual({ step: 10, ledgerLines: [10] });
  });
});
