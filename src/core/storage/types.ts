import type { MixedClef, Gamut } from '../generator/stages';

/** 主题 id：paper 暖纸乐稿（默认）/ ebony 乌木暖夜 / ink 极简墨白 / classic 经典深色 */
export const THEME_IDS = ['paper', 'ebony', 'ink', 'classic'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = 'paper';

export type Mode = 'tap'; // 里程碑 B 加 'play'（跟弹）

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
