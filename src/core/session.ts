import type { MixedClef } from './generator/stages';
import { chooseQuestion } from './generator/generator';
import type { Question } from './generator/generator';

export type ResultKind = 'correct' | 'wrong';

export interface HistoryItem {
  result: ResultKind;
  /** 目标音 MIDI（画在谱上的具体八度，用于错音登记） */
  expectedMidi: number;
  /** 目标音级（0-11） */
  expectedPc: number;
  /** 作答音级（0-11） */
  actualPc: number;
}

export interface SessionConfig {
  stage: number;
  clef: MixedClef;
  durationSec: number;
  rng: () => number;
  wrong: Record<number, number>;
}

export interface Session {
  stage: number;
  clef: MixedClef;
  durationSec: number;
  rng: () => number;
  wrong: Record<number, number>;
  target: Question;
  correct: number;
  total: number;
  history: HistoryItem[];
  last: HistoryItem | null;
}

export function createSession(c: SessionConfig): Session {
  const target = chooseQuestion(c.rng, c.stage, c.clef, c.wrong, -1);
  return { ...c, target, correct: 0, total: 0, history: [], last: null };
}

/**
 * 认音作答（pure）：按音级判定（同一字母不同八度都算对）。
 * 对则推进到下一题；错则题目停留便于马上重试，但记录进 history。
 */
export function answerTap(s: Session, guessedPc: number): Session {
  const expectedPc = s.target.midi % 12;
  const ok = guessedPc % 12 === expectedPc;
  const item: HistoryItem = {
    result: ok ? 'correct' : 'wrong',
    expectedMidi: s.target.midi,
    expectedPc,
    actualPc: guessedPc % 12,
  };
  const history = [item, ...s.history];
  const target = ok ? chooseQuestion(s.rng, s.stage, s.clef, s.wrong, s.target.midi) : s.target;
  return { ...s, target, correct: s.correct + (ok ? 1 : 0), total: s.total + 1, history, last: item };
}

/**
 * 琴键作答（pure）：按精确 MIDI 判定（八度必须一致）。
 * 对则推进下一题；错则题目停留便于重试。与 answerTap 同构，仅判定粒度不同。
 */
export function answerKey(s: Session, midi: number): Session {
  const expectedPc = s.target.midi % 12;
  const ok = midi === s.target.midi;
  const item: HistoryItem = {
    result: ok ? 'correct' : 'wrong',
    expectedMidi: s.target.midi,
    expectedPc,
    actualPc: midi % 12,
  };
  const history = [item, ...s.history];
  const target = ok ? chooseQuestion(s.rng, s.stage, s.clef, s.wrong, s.target.midi) : s.target;
  return { ...s, target, correct: s.correct + (ok ? 1 : 0), total: s.total + 1, history, last: item };
}

export interface WrongDeltas {
  /** 本轮仍未解决的错音 MIDI：需 registerMistake（加深） */
  toLearn: number[];
  /** 本轮至少答对过一次的 MIDI：需 registerCorrect（若先前有错则扣减） */
  recalled: number[];
}

/**
 * 从一局 history 归纳错音增删（history[0] 为最新，answerTap 前插）。
 * recalled：本轮至少答对过 1 次的音（若先前有错计数则 registerCorrect 扣减）；
 * toLearn：本轮结束仍停在错的音（该音最新一次作答仍 wrong，即使中途对过）→ registerMistake 加深。
 * 两集合可重叠（PracticeScreen 先加深后扣减）。按 MIDI 升序输出，保证确定性。
 */
export function computeWrongDeltas(history: HistoryItem[]): WrongDeltas {
  const recalled = new Set<number>();
  const last = new Map<number, ResultKind>(); // 每音最新一次作答（首个遇到的即最新）
  for (const h of history) {
    if (h.result === 'correct') recalled.add(h.expectedMidi);
    if (!last.has(h.expectedMidi)) last.set(h.expectedMidi, h.result);
  }
  const sort = (a: number, b: number) => a - b;
  return {
    toLearn: [...last.entries()].filter(([, r]) => r === 'wrong').map(([m]) => m).sort(sort),
    recalled: [...recalled].sort(sort),
  };
}
