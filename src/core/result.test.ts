import { describe, it, expect } from 'vitest';
import { computeResult, shouldAdvanceStage } from './result';

describe('result 结算', () => {
  it('正确 40 音 / 60 秒 → 速度 40 音/分、准确率 80%', () => {
    const r = computeResult(40, 50, 60);
    expect(r.speed).toBe(40);
    expect(r.accuracy).toBe(80);
  });

  it('空轮次不除零', () => {
    const r = computeResult(0, 0, 60);
    expect(r.speed).toBe(0);
    expect(r.accuracy).toBe(0);
  });

  it('时长 0 秒时速度为 0', () => {
    const r = computeResult(10, 10, 0);
    expect(r.speed).toBe(0);
  });

  it('升阶门槛：准确率 ≥85 达标', () => {
    expect(shouldAdvanceStage({ accuracy: 90 })).toBe(true);
    expect(shouldAdvanceStage({ accuracy: 85 })).toBe(true);
    expect(shouldAdvanceStage({ accuracy: 84 })).toBe(false);
  });
});
