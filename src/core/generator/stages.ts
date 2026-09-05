import type { Clef } from '../notation/positions';

export type MixedClef = Clef | 'mixed';

export const MAX_STAGE = 5;

// 默认参数（可调）。高音谱以 C4 为锚向上、低音谱以 C4 为锚向下（含加线）。
// 只含自然音：BASS_DOWN 依次 C4 B3 A3 G3 F3 E3 D3 C3 B2 A2 G2。
const TREBLE_UP = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79]; // C4..G5
const BASS_DOWN = [60, 59, 57, 55, 53, 52, 50, 48, 47, 45, 43]; // C4..G2

/** 每阶段高音/低音池的音数（S1 高音 3 音起，低音从 S2 加入） */
const SIZE: Record<number, { treble: number; bass: number }> = {
  1: { treble: 3, bass: 0 },
  2: { treble: 5, bass: 3 },
  3: { treble: 7, bass: 5 },
  4: { treble: 9, bass: 7 },
  5: { treble: TREBLE_UP.length, bass: BASS_DOWN.length },
};

/** 某谱号在某阶段的可用音符池 */
export function poolForStage(stage: number, clef: MixedClef): number[] {
  const s = Math.max(1, Math.min(MAX_STAGE, stage));
  if (clef === 'mixed') {
    return [...TREBLE_UP.slice(0, SIZE[s].treble), ...BASS_DOWN.slice(0, SIZE[s].bass)];
  }
  return (clef === 'treble' ? TREBLE_UP : BASS_DOWN).slice(0, SIZE[s][clef]);
}

/** 谱号解锁所需阶段：高音 S1、低音 S2、混合 S3 */
export function clefUnlockStage(clef: MixedClef): number {
  return clef === 'treble' ? 1 : clef === 'bass' ? 2 : 3;
}
