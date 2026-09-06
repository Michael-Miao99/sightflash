import type { MixedClef, Gamut } from '../generator/stages';

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
