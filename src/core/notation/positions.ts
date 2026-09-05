// 五线位置数学：把 MIDI 音高换算成"谱表步"。
// 相邻线/间各差 1 步；五线位置在偶数步 0,2,4,6,8，间在奇数步。step 0 = 谱表底线。

import { nameToMidi, letterIndex, midiToPc } from './note';

export type Clef = 'treble' | 'bass';

export const CLEF_BOTTOM_LINE: Record<Clef, string> = {
  treble: 'E4',
  bass: 'G2',
};

export interface StaffNoteLayout {
  /** 音符头中心的谱表步（偶=线，奇=间） */
  step: number;
  /** 需绘制的加线 step 列表（越界的线位步）。空间音符无加线。 */
  ledgerLines: number[];
}

/** midi → 全音阶序号（每字母 +1，跨八度 +7）。仅对自然音精确。 */
function diatonicOfMidi(midi: number): number {
  const octave = Math.floor(midi / 12) - 1;
  const letter = midiToPc(midi)[0]; // 自然音取字母
  return octave * 7 + letterIndex(letter);
}

/** 音符相对谱表底线的谱表步 */
export function staffStep(midi: number, clef: Clef): number {
  const bottom = nameToMidi(CLEF_BOTTOM_LINE[clef])!;
  return diatonicOfMidi(midi) - diatonicOfMidi(bottom);
}

/** 越界音符的加线：只在线位步（偶数）出现 */
export function ledgerLinesOf(midi: number, clef: Clef): number[] {
  const step = staffStep(midi, clef);
  const out: number[] = [];
  if (step > 8) {
    for (let s = 10; s <= step; s += 2) out.push(s);
  } else if (step < 0) {
    for (let s = -2; s >= step; s -= 2) out.push(s);
  }
  return out;
}

/** 布局：给渲染层一次性提供 step 与加线 */
export function layoutStaffNote(midi: number, clef: Clef): StaffNoteLayout {
  return { step: staffStep(midi, clef), ledgerLines: ledgerLinesOf(midi, clef) };
}
