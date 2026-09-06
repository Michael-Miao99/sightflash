import { describe, expect, it } from 'vitest';
import { finalizeSession } from './finalize';
import { defaultState, makeDay } from './storage/logic';
import { MAX_STAGE } from './generator/stages';
import type { HistoryItem } from './session';

// 本地构造，规避时区：ts 与 DAY 取自同一 Date → 断言与运行环境时区无关
const NOW = new Date(2026, 8, 5, 12, 0, 0);
const TS = NOW.getTime();
const DAY = makeDay(NOW);

/** 快速构造一条 history 作答记录（expectedPc 由 expectedMidi 推得，避免手写错误） */
function h(result: 'correct' | 'wrong', midi: number, actualPc?: number): HistoryItem {
  return { result, expectedMidi: midi, expectedPc: midi % 12, actualPc: actualPc ?? midi % 12 };
}

describe('finalizeSession 轮次结算纯函数', () => {
  it('准确率≥85：升阶、advanced:true，记录保留本轮练的阶段', () => {
    const prev = defaultState(); // stage 1
    const res = finalizeSession(prev, {
      correct: 50, total: 50, durationSec: 60,
      history: [], stage: 1, clef: 'treble', ts: TS,
    });
    expect(res.advanced).toBe(true);
    expect(res.progress.stage).toBe(2);
    expect(res.streak.current).toBe(1);
    expect(res.streak.lastDate).toBe(DAY);
    expect(res.daily).toEqual({ date: DAY, correct: 50 });
    // 记录写入的是"本轮练的阶段"，非升阶后
    expect(res.record.stage).toBe(1);
    expect(res.record.mode).toBe('tap');
    expect(res.record.clef).toBe('treble');
    expect(res.record.correct).toBe(50);
    expect(res.record.accuracy).toBe(100);
    expect(res.record.speed).toBe(50);
    expect(res.record.ts).toBe(TS);
  });

  it('准确率<85：不升阶、advanced:false', () => {
    const prev = { ...defaultState(), progress: { stage: 2, wrong: {} } };
    const res = finalizeSession(prev, {
      correct: 10, total: 20, durationSec: 60,
      history: [], stage: 2, clef: 'bass', ts: TS,
    });
    expect(res.advanced).toBe(false);
    expect(res.progress.stage).toBe(2);
  });

  it('封顶 S5：100% 准确率也不升阶', () => {
    const prev = { ...defaultState(), progress: { stage: MAX_STAGE, wrong: {} } };
    const res = finalizeSession(prev, {
      correct: 30, total: 30, durationSec: 60,
      history: [], stage: 5, clef: 'treble', ts: TS,
    });
    expect(res.advanced).toBe(false);
    expect(res.progress.stage).toBe(5);
  });

  it('错音池增量：答对过的出池(减1)，结束仍错的加深(+1)', () => {
    const prev = { ...defaultState(), progress: { stage: 1, wrong: { 67: 2 } } };
    const res = finalizeSession(prev, {
      correct: 8, total: 10, durationSec: 60,
      history: [
        h('wrong', 60), // 最新仍错且从未答对 → toLearn，加深 +1
        h('correct', 67), // 答对过 → recalled，67 减 1
      ],
      stage: 1, clef: 'treble', ts: TS,
    });
    expect(res.progress.wrong).toEqual({ 67: 1, 60: 1 });
  });

  it('重叠音（中途对过、结束仍错）净效果不变：先加深后扣减', () => {
    const prev = defaultState(); // wrong 池为空
    const res = finalizeSession(prev, {
      correct: 5, total: 10, durationSec: 60,
      history: [
        h('wrong', 64), // 最新仍错 → toLearn，先 registerMistake 加深为 1
        h('correct', 64), // 中途答对 → recalled，再 registerCorrect 扣回 0（删除）
        h('correct', 67), // 答对 → recalled，但 67 本无错计数 → no-op
      ],
      stage: 1, clef: 'treble', ts: TS,
    });
    // 有意为之：64 加深 1 又扣减 1 → 净效果不变；67 不受影响
    expect(res.progress.wrong).toEqual({});
  });

  it('mode 透传：finalizeSession 以入参 mode 写 record.mode（缺省 tap）', () => {
    const prev = defaultState();
    const base = {
      correct: 5, total: 10, durationSec: 60,
      history: [], stage: 1, clef: 'treble' as const, ts: TS,
    };
    const play = finalizeSession(prev, { ...base, mode: 'play' });
    expect(play.record.mode).toBe('play');
    const tap = finalizeSession(prev, base); // 未传 mode → 回落 tap（既有调用/老测试不破坏）
    expect(tap.record.mode).toBe('tap');
  });
});
