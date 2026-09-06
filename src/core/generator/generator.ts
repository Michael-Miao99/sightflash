import type { Clef } from '../notation/positions';
import type { MixedClef, Gamut } from './stages';
import { poolForStage } from './stages';
import type { Accidental } from '../notation/note';

/** 可注入种子的 PRNG（mulberry32）—— 测试可复现 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(rng: () => number, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** 黑键半音集合（决定某 midi 是否为黑键 / 是否有 #/b 两种拼写） */
const BLACK_PC = new Set([1, 3, 6, 8, 10]);

/** 在单谱池内抽一个音。wrong[midi] 越高权重越大；相邻不重复（最多重抽 5 次）。gamut 决定池是否含黑键。 */
export function chooseMidi(
  rng: () => number,
  stage: number,
  clef: MixedClef,
  wrong: Record<number, number>,
  prev: number,
  gamut: Gamut = 'natural',
): number {
  const pool = poolForStage(stage, clef, gamut);
  if (pool.length === 0) throw new Error(`empty note pool: clef=${clef} stage=${stage}`);
  const weights = pool.map((m) => 1 + Math.min(wrong[m] ?? 0, 3));
  let chosen = pickWeighted(rng, pool, weights);
  if (pool.length > 1) {
    let guard = 0;
    while (chosen === prev && guard++ < 5) chosen = pickWeighted(rng, pool, weights);
  }
  return chosen;
}

export interface Question {
  midi: number;
  clef: Clef;
  /** 变化音拼写：# / ♭。自然音为 undefined。仅 chromatic 池的黑键题会被赋值。 */
  acc?: Accidental;
}

/**
 * 出下一题。选择谱号：clef='mixed' 时每道题 50/50 掷高音/低音谱；
 * 其余用指定谱。再在对应池内抽音（prev 为上一题的 midi，避免相邻同音）。
 * chromatic 下抽中黑键时用 rng 50/50 记 acc。
 */
export function chooseQuestion(
  rng: () => number,
  stage: number,
  clef: MixedClef,
  wrong: Record<number, number>,
  prev: number,
  gamut: Gamut = 'natural',
): Question {
  const sub: Clef = clef === 'mixed' ? (rng() < 0.5 ? 'treble' : 'bass') : clef;
  const midi = chooseMidi(rng, stage, sub, wrong, prev, gamut);
  const acc: Accidental | undefined =
    gamut === 'chromatic' && BLACK_PC.has(midi % 12) ? (rng() < 0.5 ? '#' : 'b') : undefined;
  return { midi, clef: sub, acc };
}
