import { describe, it, expect } from 'vitest';
import { defaultState, makeDay, applyStreak, applyDaily, registerMistake, registerCorrect } from './logic';

describe('storage logic 状态机', () => {
  it('defaultState 从 S1 开始且无错音', () => {
    const s = defaultState();
    expect(s.progress.stage).toBe(1);
    expect(s.progress.wrong).toEqual({});
    expect(s.settings.gamut).toBe('natural'); // 练黑键（变化音）默认关
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

  it('registerCorrect：无错音记录时原样返回（不新增键）', () => {
    const p = defaultState().progress;
    expect(registerCorrect(p, 62)).toBe(p);
    expect(p.wrong).toEqual({});
  });

  it('makeDay 输出本地 YYYY-MM-DD', () => {
    expect(makeDay(new Date(2026, 8, 5, 12))).toBe('2026-09-05');
  });
});
