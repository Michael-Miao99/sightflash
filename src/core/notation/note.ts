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

/** 变化音记号类型：升号 / 降号。自然音无记号（null / 缺省）。 */
export type Accidental = '#' | 'b';

/** 取音级名（含升降号）。本 App natural 池内只含自然音。 */
export function midiToPc(midi: number): PitchClass {
  return PITCH_CLASSES[((midi % 12) + 12) % 12];
}

/** midi → "C4" 形音名（升号拼写为默认，natural 音名不受影响） */
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

/**
 * 变化音拼写 → 谱表定位音（自然音）：# 用其下方自然音（midi−1，如 C#4→C4），
 * b 用其上方自然音（midi+1，如 Db4→D4），无记号原样。仅黑键（pc∈{1,3,6,8,10}）
 * 存在 #/b 两种拼写；调用方应只对黑键传记号。
 */
export function letterMidiOf(midi: number, acc: Accidental | null | undefined): number {
  if (acc === '#') return midi - 1;
  if (acc === 'b') return midi + 1;
  return midi;
}

/** 含记号的音名：spelledName(61,'b') → "Db4"；自然音无 acc → 同 midiToName。 */
export function spelledName(midi: number, acc: Accidental | null | undefined): string {
  if (!acc) return midiToName(midi);
  const letterMidi = letterMidiOf(midi, acc); // 拼写字母所在音（自然音）
  const letter = midiToPc(letterMidi)[0];
  const octave = Math.floor(midi / 12) - 1;
  return `${letter}${acc}${octave}`;
}
