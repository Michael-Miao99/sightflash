import type { Clef } from '../notation/positions';
import type { MixedClef } from './stages';
import { poolForStage } from './stages';

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

/** 在单谱池内抽一个音。wrong[midi] 越高权重越大；相邻不重复（最多重抽 5 次）。 */
export function chooseMidi(
  rng: () => number,
  stage: number,
  clef: MixedClef,
  wrong: Record<number, number>,
  prev: number,
): number {
  const pool = poolForStage(stage, clef);
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
}

/**
 * 出下一题。选择谱号：clef='mixed' 时每道题 50/50 掷高音/低音谱；
 * 其余用指定谱。再在对应池内抽音（prev 为上一题的 midi，避免相邻同音）。
 */
export function chooseQuestion(
  rng: () => number,
  stage: number,
  clef: MixedClef,
  wrong: Record<number, number>,
  prev: number,
): Question {
  const sub: Clef = clef === 'mixed' ? (rng() < 0.5 ? 'treble' : 'bass') : clef;
  const midi = chooseMidi(rng, stage, sub, wrong, prev);
  return { midi, clef: sub };
}
