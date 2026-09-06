import type { Clef } from '../notation/positions';

export type MixedClef = Clef | 'mixed';

/** 音域：natural 只自然音（现状默认）；chromatic 在当前谱号+当前 S 音域内补入黑键 */
export type Gamut = 'natural' | 'chromatic';

export const MAX_STAGE = 5;

// 默认参数（可调）。高音谱以 C4 为锚向上、低音谱以 C4 为锚向下（含加线）。
// 只含自然音：TREBLE_UP 依次 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5（C4..G5）；
// BASS_DOWN 依次 C4 B3 A3 G3 F3 E3 D3 C3 B2 A2 G2（C4..G2）。
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

/** 自然音母上方紧邻有黑键的半音（C/D/F/G/A → 有上邻黑键；E/B 无） */
const SHARPABLE_PC = new Set([0, 2, 5, 7, 9]);

function clampStage(stage: number): number {
  return Math.max(1, Math.min(MAX_STAGE, stage));
}

/** 某谱号的自然音前缀（保持既有顺序语义：高音升序、低音降序） */
function naturalSlice(stage: number, clef: Exclude<MixedClef, 'mixed'>): number[] {
  const s = clampStage(stage);
  return (clef === 'treble' ? TREBLE_UP : BASS_DOWN).slice(0, SIZE[s][clef]);
}

/** 在自然音前缀上补黑键：对每个自然音 m，若 m 上邻是黑键且不越池顶（m%12∈SHARPABLE_PC 且 m+1≤池顶），则加入 m+1。升序去重。 */
function chromaticize(naturals: readonly number[]): number[] {
  if (naturals.length === 0) return [];
  const top = Math.max(...naturals);
  const blacks = naturals
    .filter((m) => SHARPABLE_PC.has(m % 12))
    .map((m) => m + 1)
    .filter((m) => m <= top);
  return [...new Set([...naturals, ...blacks])].sort((a, b) => a - b);
}

/** 某谱号在某阶段的可用音符池。gamut='natural' 返回与旧版逐位一致的数组；'chromatic' 补入同音域黑键。 */
export function poolForStage(stage: number, clef: MixedClef, gamut: Gamut = 'natural'): number[] {
  if (gamut === 'chromatic') {
    if (clef === 'mixed') {
      return [...chromaticize(naturalSlice(stage, 'treble')), ...chromaticize(naturalSlice(stage, 'bass'))];
    }
    return chromaticize(naturalSlice(stage, clef));
  }
  const s = clampStage(stage);
  if (clef === 'mixed') {
    return [...TREBLE_UP.slice(0, SIZE[s].treble), ...BASS_DOWN.slice(0, SIZE[s].bass)];
  }
  return (clef === 'treble' ? TREBLE_UP : BASS_DOWN).slice(0, SIZE[s][clef]);
}

/** 谱号解锁所需阶段：高音 S1、低音 S2、混合 S3 */
export function clefUnlockStage(clef: MixedClef): number {
  return clef === 'treble' ? 1 : clef === 'bass' ? 2 : 3;
}
