import { describe, it, expect } from 'vitest';
import { createSession, answerTap, answerKey, computeWrongDeltas } from './session';
import type { Session } from './session';
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

  it('computeWrongDeltas：结束仍错的音加深，答对过的音出池', () => {
    // history[0] 为最新（answerTap 前插）。C4 最新仍 wrong（进入 toLearn，但也答对过→recalled），G4 答对解决。
    const base = { result: 'wrong' as const, expectedMidi: 60, expectedPc: 0, actualPc: 2 };
    const hist = [
      { result: 'correct' as const, expectedMidi: 67, expectedPc: 7, actualPc: 7 },
      { ...base, result: 'wrong' as const },
      { result: 'correct' as const, expectedMidi: 60, expectedPc: 0, actualPc: 0 },
      { ...base },
    ];
    const d = computeWrongDeltas(hist);
    expect(d.toLearn).toEqual([60]); // C4 结束仍错 → 加深
    expect(d.recalled).toEqual([60, 67]); // C4/G4 本轮都答对过 → 出池
  });
});

function makeSession(targetMidi: number): Session {
  return {
    stage: 1,
    clef: 'treble',
    durationSec: 60,
    rng: () => 0.5,
    wrong: {},
    target: { midi: targetMidi, clef: 'treble' },
    correct: 0,
    total: 0,
    history: [],
    last: null,
  };
}

describe('answerKey 精确八度作答', () => {
  it('点到同一 MIDI 判对：计入正确、推进下一题', () => {
    const s = makeSession(60); // C4
    const next = answerKey(s, 60);
    expect(next.last?.result).toBe('correct');
    expect(next.correct).toBe(1);
    expect(next.total).toBe(1);
    expect(next.history[0]).toMatchObject({ expectedMidi: 60, actualPc: 0 });
    expect(next.target).not.toBe(s.target); // 推进到新题
  });

  it('同音名错八度（C5=72）判错：题目停留可重试', () => {
    const s = makeSession(60);
    const next = answerKey(s, 72);
    expect(next.last?.result).toBe('wrong');
    expect(next.correct).toBe(0);
    expect(next.total).toBe(1);
    expect(next.history[0].actualPc).toBe(0);
    expect(next.target).toBe(s.target); // 未推进
  });

  it('点黑键（如 C#4=61）对自然音目标恒判错', () => {
    const s = makeSession(62); // D4 自然音
    const next = answerKey(s, 61); // C#4
    expect(next.last?.result).toBe('wrong');
    expect(next.correct).toBe(0);
    expect(next.history[0].actualPc).toBe(1);
  });
});
