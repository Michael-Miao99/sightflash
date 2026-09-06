// 音高换算与比对纯函数（§27.3）。YIN 频率→MIDI、判对谓词、偏差文案都归一于此；
// ui/piano.ts 的播放换算已收敛为 midiToHz 别名，避免双源。
import { midiToName } from '../notation/note';

/** MIDI → 频率(Hz)。A4(69)=440 */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** 频率(Hz) → MIDI（浮点，可含非整半音） */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** 取整 MIDI（最近半音；JS Math.round 半向上） */
export function roundToMidi(f: number): number {
  return Math.round(f);
}

/** 有符号音分差（MIDI 域，1 半音 = 100¢）：正 = a 比 b 高 */
export function centsBetween(a: number, b: number): number {
  return (a - b) * 100;
}

/** 判对容差：目标 ±30 音分（§8⑤ / §27.2）。30¢≪半音 ⇒ 同音自动蕴含八度一致。 */
export const MATCH_TOL_CENTS = 30;

/** 判对谓词：|playedMidi − targetMidi| × 100 ≤ tolCents 视为同音。判题与校准共用。 */
export function matches(
  playedMidi: number,
  targetMidi: number,
  tolCents: number = MATCH_TOL_CENTS,
): boolean {
  return Math.abs(playedMidi - targetMidi) * 100 <= tolCents;
}

/**
 * 弹错时给反馈区的一句偏差提示（§27.2 文案，判题/校准措辞同源）。
 * actualMidi 为起音实际音高（可带音分偏差）；命中（±30¢ 内）返回 ''（调用方不该在此分支调用）。
 * 分支：同键但偏 30~50¢ → "偏高/偏低 N 音分"；同音名跨八度 → "比目标高/低一个八度"；
 *       同八度跨音 → "偏高/偏低 N 个半音"；跨音名+跨八度 → "偏离音区"。
 */
export function deviationLabel(actualMidi: number, targetMidi: number): string {
  if (matches(actualMidi, targetMidi)) return '';
  const a = Math.round(actualMidi);
  const playedName = midiToName(a);
  const tName = midiToName(targetMidi);
  const d = a - targetMidi;
  if (a === targetMidi) {
    // 同键但 30¢<|Δ|<50¢（round 后仍落同键）：报音分偏差
    const cents = Math.abs(Math.round((actualMidi - targetMidi) * 100));
    const dir = actualMidi > targetMidi ? '偏高' : '偏低';
    return `你弹了 ${playedName}：${dir} ${cents} 音分`;
  }
  if (a % 12 === targetMidi % 12) {
    // 同音名：按八度差报（n=1 用"一个八度"，n≥2 用"N 个八度"）
    const n = Math.abs(d) / 12;
    const head = d > 0 ? '高' : '低';
    return `你弹了 ${playedName}：比目标${head}${n === 1 ? '一个八度' : ` ${n} 个八度`}`;
  }
  if (Math.abs(d) < 12) {
    return d > 0 ? `你弹了 ${playedName}：偏高 ${d} 个半音` : `你弹了 ${playedName}：偏低 ${-d} 个半音`;
  }
  return `你弹了 ${playedName}：偏离音区（谱面 ${tName}）`;
}
