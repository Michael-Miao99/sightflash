import type { MixedClef, Gamut } from './generator/stages';
import { chooseQuestion } from './generator/generator';
import type { Question } from './generator/generator';
import type { Mode } from './storage/types';
import { matches } from './audio/pitch';

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
  gamut?: Gamut;
  /** 本轮模式（认音 tap / 跟弹 play）；透传展示用，判题不走它 */
  mode?: Mode;
}

export interface Session {
  stage: number;
  clef: MixedClef;
  durationSec: number;
  rng: () => number;
  wrong: Record<number, number>;
  gamut?: Gamut;
  /** 本轮模式（认音 tap / 跟弹 play）；透传展示用，判题不走它 */
  mode?: Mode;
  target: Question;
  correct: number;
  total: number;
  history: HistoryItem[];
  last: HistoryItem | null;
}

export function createSession(c: SessionConfig): Session {
  const target = chooseQuestion(c.rng, c.stage, c.clef, c.wrong, -1, c.gamut);
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
  const target = ok ? chooseQuestion(s.rng, s.stage, s.clef, s.wrong, s.target.midi, s.gamut) : s.target;
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
  const target = ok ? chooseQuestion(s.rng, s.stage, s.clef, s.wrong, s.target.midi, s.gamut) : s.target;
  return { ...s, target, correct: s.correct + (ok ? 1 : 0), total: s.total + 1, history, last: item };
}

/**
 * 跟弹作答（pure，§27.2 首击成败）：playedMidi 为起音的实际浮点 MIDI（可含音分偏差）。
 * 只判每题第一个起音："本题是否已判"直接看状态机——停在本题当且仅当 last 是对本题首击错的定格
 * （last.result==='wrong' && last.expectedMidi===target.midi）；推进/逃生后 last 只会是 null 或上一题的记录，
 * 故不依赖邻避也能把"相邻同音的新题"正确判为首击（终审回归：邻避只是概率性，见 generator 重抽上限）。
 * 首击 → 命中(matches ±30¢)记 correct 并推进；不中记 wrong 停留。
 * 已判过（首击错、停留中）→ 试错不再记 history / 不 total+1；终于弹对(matches)推进、不新增记录，
 * 仅 last 置一次 correct 供 ✓ 反馈。
 * 判定粒度 ±30¢≪半音 ⇒ 同音自动蕴含八度一致（无需单列八度比较）。
 */
export function answerPlay(s: Session, playedMidi: number): Session {
  const target = s.target;
  const ok = matches(playedMidi, target.midi);
  const roundMidi = Math.round(playedMidi);
  const item: HistoryItem = {
    result: ok ? 'correct' : 'wrong',
    expectedMidi: target.midi,
    expectedPc: target.midi % 12,
    actualPc: ((roundMidi % 12) + 12) % 12,
  };
  // 该题首击是否已定：停在本题（last 是对本题首击错的定格）才算已判；其余（新题 / 推进后同音再现）都算首击
  const firstShot = !(s.last?.result === 'wrong' && s.last?.expectedMidi === target.midi);
  const advance = ok ? chooseQuestion(s.rng, s.stage, s.clef, s.wrong, target.midi, s.gamut) : target;
  if (firstShot) {
    return {
      ...s, target: advance,
      correct: s.correct + (ok ? 1 : 0), total: s.total + 1,
      history: [item, ...s.history], last: item,
    };
  }
  return { ...s, target: advance, last: item }; // 试错：不改计数/历史；ok 时 last=correct 供反馈
}

/**
 * 逃生（pure，§27.5 [下一题]）：把"首击已判错、停留"的题强行推进，此题成绩已定格。
 * 不改 total/correct/history；last 清空（新题未弹过，回到待听状态）。
 */
export function skipQuestion(s: Session): Session {
  const target = chooseQuestion(s.rng, s.stage, s.clef, s.wrong, s.target.midi, s.gamut);
  return { ...s, target, last: null };
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
