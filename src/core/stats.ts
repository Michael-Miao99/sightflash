import type { Mode, SessionRecord } from './storage/types';

/** 统计模式筛选：全部（缺省）/ 认音 tap / 跟弹 play。只作用于 sessions 驱动的曲线（§27.6）。 */
export type ModeFilter = Mode | 'all';

export interface Point {
  ts: number;
  value: number;
}

function byMode(sessions: SessionRecord[], mode: ModeFilter): SessionRecord[] {
  return mode === 'all' ? sessions : sessions.filter((s) => s.mode === mode);
}

/** 每次练习的速度（按时间升序）；mode='all' 时含两模式 */
export function speedTrend(sessions: SessionRecord[], mode: ModeFilter = 'all'): Point[] {
  return byMode(sessions, mode)
    .sort((a, b) => a.ts - b.ts)
    .map((s) => ({ ts: s.ts, value: s.speed }));
}

/** 最近 20 次准确率（时间升序）；mode='all' 时含两模式 */
export function latestAccuracies(sessions: SessionRecord[], mode: ModeFilter = 'all'): number[] {
  return byMode(sessions, mode)
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
