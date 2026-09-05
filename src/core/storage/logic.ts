import type { AppState, Progress, Streak, Daily } from './types';

export const DAILY_GOAL = 100;

export function defaultState(): AppState {
  return {
    progress: { stage: 1, wrong: {} },
    settings: { sound: true, durationSec: 60, lastMode: 'tap', lastClef: 'treble' },
    streak: { current: 0, lastDate: '' },
    daily: { date: '', correct: 0 },
  };
}

/** 本地日期 → "YYYY-MM-DD" */
export function makeDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 打卡：昨天连上则 +1，断签从 1 重计，同日幂等 */
export function applyStreak(streak: Streak, today: string): Streak {
  if (streak.lastDate === today) return streak;
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const yDay = makeDay(d);
  if (streak.lastDate === yDay) return { current: streak.current + 1, lastDate: today };
  return { current: 1, lastDate: today };
}

/** 每日正确数累计（跨天清零） */
export function applyDaily(daily: Daily, today: string, add: number): Daily {
  if (daily.date === today) return { ...daily, correct: daily.correct + add };
  return { date: today, correct: add };
}

/** 答错：该音错计数 +1（返回新对象） */
export function registerMistake(p: Progress, midi: number): Progress {
  return { ...p, wrong: { ...p.wrong, [midi]: (p.wrong[midi] ?? 0) + 1 } };
}

/** 答对：若该音有错计数则扣 1，至 0 删除 */
export function registerCorrect(p: Progress, midi: number): Progress {
  if (!p.wrong[midi]) return p;
  const next = { ...p.wrong, [midi]: p.wrong[midi] - 1 };
  if (next[midi] <= 0) delete next[midi];
  return { ...p, wrong: next };
}
