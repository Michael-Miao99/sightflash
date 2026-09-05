// 音高模型：统一用 MIDI 号表示音高（C4=60）。命名体系为音名 C~B。

export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type PitchClass = (typeof PITCH_CLASSES)[number];

/** 自然音字母 → 半音内音级（C=0 … B=11） */
export const LETTER_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export const LETTER_INDEX: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

/** 取音级名（含升降号）。本 App 池内只含自然音。 */
export function midiToPc(midi: number): PitchClass {
  return PITCH_CLASSES[((midi % 12) + 12) % 12];
}

/** midi → "C4" 形音名 */
export function midiToName(midi: number): string {
  const pc = midiToPc(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${pc}${octave}`;
}

/** "C4" 形音名 → midi；非法输入返回 null。仅支持 C~G 及可选 #。 */
export function nameToMidi(name: string): number | null {
  const m = /^([A-G])(#?)(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const semitone = LETTER_PC[m[1]] + (m[2] === '#' ? 1 : 0);
  const octave = parseInt(m[3], 10);
  return 12 * (octave + 1) + semitone;
}

/** 自然音字母的序号：C=0 … B=6 */
export function letterIndex(pc: string): number {
  return LETTER_INDEX[pc[0]] ?? 0;
}
