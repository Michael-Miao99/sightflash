import type { MixedClef, Gamut } from '../generator/stages';

/** 主题 id：paper 暖纸乐稿（默认）/ ebony 乌木暖夜 / ink 极简墨白 / classic 经典深色 */
export const THEME_IDS = ['paper', 'ebony', 'ink', 'classic'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = 'paper';

export type Mode = 'tap' | 'play'; // 认音 / 跟弹（里程碑 B §27，2026-09-06）

export interface Progress {
  stage: number;
  wrong: Record<number, number>;
}

export interface Settings {
  sound: boolean;
  durationSec: number; // 30 | 60
  lastMode: Mode;
  lastClef: MixedClef;
  gamut: Gamut; // 练黑键（变化音）全局开关
  theme: ThemeId; // 主题（§26）：paper|ebony|ink|classic，缺省回落 DEFAULT_THEME
  /** 跟弹开关沿用偏好（§28 定稿后老板追加）：进练习屏默认带上次开/关状态；缺省 false（老档兜底） */
  followPlay: boolean;
  /** 麦克风灵敏度（老板可调，0..100，§28 后追加）：0=最灵敏、100=最钝；缺省 DEFAULT_MIC_SENS（onset.ts） */
  micSens: number;
  /** 跟弹输入偏好 MIDI（§29）：设置页连接过 MIDI 键盘后置 true → 跟弹开自动优先用 MIDI 作答，无设备回落麦克风；缺省 false */
  midiPrefer: boolean;
}

export interface Streak {
  current: number;
  lastDate: string; // YYYY-MM-DD
}

export interface Daily {
  date: string;
  correct: number;
}

export interface AppState {
  progress: Progress;
  settings: Settings;
  streak: Streak;
  daily: Daily;
}

export interface SessionRecord {
  id?: number;
  ts: number;
  mode: Mode;
  clef: MixedClef;
  stage: number;
  correct: number;
  total: number;
  durationSec: number;
  speed: number;
  accuracy: number;
}
