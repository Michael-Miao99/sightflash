import { describe, it, expect } from 'vitest';
import { speedTrend, latestAccuracies, errorDistribution } from './stats';
import type { SessionRecord } from './storage/types';

const mk = (ts: number, speed: number, accuracy: number): SessionRecord =>
  ({ ts, mode: 'tap', clef: 'treble', stage: 1, correct: 10, total: 12, durationSec: 60, speed, accuracy });

describe('stats', () => {
  it('speedTrend 按 ts 升序', () => {
    const t = speedTrend([mk(3, 30, 80), mk(1, 20, 80), mk(2, 25, 80)]);
    expect(t.map((p) => p.value)).toEqual([20, 25, 30]);
  });

  it('latestAccuracies 取最近 20 次', () => {
    const many = Array.from({ length: 25 }, (_, i) => mk(i, 10, i));
    const a = latestAccuracies(many);
    expect(a.length).toBe(20);
    expect(a[0]).toBe(5);
  });

  it('errorDistribution 降序返回', () => {
    const dist = errorDistribution({ 60: 5, 64: 9, 67: 1 });
    expect(dist[0]).toEqual({ midi: 64, count: 9 });
  });
});
