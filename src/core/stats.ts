import type { SessionRecord } from './storage/types';

export interface Point {
  ts: number;
  value: number;
}

/** 每次练习的速度（按时间升序） */
export function speedTrend(sessions: SessionRecord[]): Point[] {
  return [...sessions]
    .sort((a, b) => a.ts - b.ts)
    .map((s) => ({ ts: s.ts, value: s.speed }));
}

/** 最近 20 次准确率（时间升序） */
export function latestAccuracies(sessions: SessionRecord[]): number[] {
  return [...sessions]
    .sort((a, b) => a.ts - b.ts)
    .slice(-20)
    .map((s) => s.accuracy);
}

/** 错音分布：降序 */
export function errorDistribution(wrong: Record<number, number>): Array<{ midi: number; count: number }> {
  return Object.entries(wrong)
    .map(([midi, count]) => ({ midi: Number(midi), count }))
    .sort((a, b) => b.count - a.count);
}
