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

describe('stats 模式过滤（§27.6：只筛 sessions 驱动的曲线，不碰全局错音池）', () => {
  const mkMode = (ts: number, speed: number, accuracy: number, mode: 'tap' | 'play'): SessionRecord =>
    ({ ts, mode, clef: 'treble', stage: 1, correct: 10, total: 12, durationSec: 60, speed, accuracy });

  it('speedTrend / latestAccuracies 传 mode 时只统计该模式记录', () => {
    const rows = [mkMode(1, 20, 80, 'tap'), mkMode(2, 30, 90, 'play'), mkMode(3, 25, 85, 'tap')];
    expect(speedTrend(rows, 'play').map((p) => p.value)).toEqual([30]);
    expect(speedTrend(rows, 'tap').map((p) => p.value)).toEqual([20, 25]);
    expect(latestAccuracies(rows, 'play')).toEqual([90]);
    expect(latestAccuracies(rows, 'tap')).toEqual([80, 85]);
  });

  it('缺省 all 保持既有行为（时间升序全量）', () => {
    const rows = [mkMode(3, 30, 90, 'play'), mkMode(1, 20, 80, 'tap')];
    expect(speedTrend(rows).map((p) => p.value)).toEqual([20, 30]);
    expect(latestAccuracies(rows)).toEqual([80, 90]);
  });
});
