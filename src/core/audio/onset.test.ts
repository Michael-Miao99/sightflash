import { describe, expect, it } from 'vitest';
import {
  OnsetGate, RMS_ON, RMS_OFF, STABLE_FRAMES, LOCK_FRAMES,
  sensToThresholds, DEFAULT_MIC_SENS, MIC_SENS_MIN, MIC_SENS_MAX,
} from './onset';
import { midiToHz } from './pitch';

const hz = (midi: number) => midiToHz(midi); // 直接由 pitch 反算，保证事件 midi 断言干净

/** 喂一串帧（rms,pitchHz），返回每个 feed 是否产出起音事件 */
function run(gate: OnsetGate, frames: Array<[number, number | null]>): Array<boolean> {
  return frames.map(([rms, p]) => gate.feed(rms, p) !== null);
}

describe('OnsetGate 起音门（§27.3）', () => {
  it('能量过阈 + 音高稳定连续帧才触发一次；期间同键持续不再触发；松键后可再触发', () => {
    const g = new OnsetGate();
    const A4 = hz(69);
    const got = run(g, [
      [0.4, A4],            // 候选 run1
      [0.4, A4],            // run2 → 触发
      [0.4, A4],            // 闭锁/持续 同键 → 不再触发
      [0.4, A4],
      [0.4, A4],
      [0.001, null],        // 松键复位
      [0.4, A4],            // 新一次弹奏 候选 run1
      [0.4, A4],            // run2 → 再次触发
    ]);
    expect(got).toEqual([false, true, false, false, false, false, false, true]);
  });

  it('踏板连音（不松键）换到 ≥1.5 半音的新音可再触发；同音名八度外快弹同理', () => {
    const g = new OnsetGate();
    const A4 = hz(69);
    const E5 = hz(76); // 差 7 半音
    const got = run(g, [
      [0.4, A4],
      [0.4, A4],            // → 触发 A4
      [0.4, E5],            // 闭锁期换音 → 重开候选 run1
      [0.4, E5],            // run2 → 触发 E5（无需松键）
    ]);
    expect(got).toEqual([false, true, false, true]);
  });

  it('瞬时噪声 / 无稳定音高：能量再大也不触发', () => {
    const g = new OnsetGate();
    const got = run(g, [
      [0.5, null], [0.5, null], [0.5, null], [0.5, null],
    ]);
    expect(got).toEqual([false, false, false, false]);
  });

  it('单个响帧即停（不足稳定帧）不触发——瞬态/拍键被拒', () => {
    const g = new OnsetGate();
    const got = run(g, [[0.4, hz(69)], [0.001, null], [0.4, hz(69)], [0.001, null]]);
    expect(got).toEqual([false, false, false, false]);
  });

  it('闭锁期内同键快速重复不误判（消抖）', () => {
    const g = new OnsetGate();
    const A4 = hz(69);
    const got = run(g, [[0.4, A4], [0.4, A4], [0.4, A4], [0.4, A4], [0.4, A4]]);
    expect(got).toEqual([false, true, false, false, false]);
  });

  it('事件携带取整 midi 与音分偏差（事件 {midi,cents}）', () => {
    const g = new OnsetGate();
    const off = hz(69.3); // A4 + 30¢（避开 .5 半音正中边界）
    g.feed(0.4, off);
    const evt = g.feed(0.4, off);
    expect(evt).not.toBeNull();
    expect(evt!.midi).toBe(69);
    expect(evt!.cents).toBe(30);
  });

  it('参数常量与 §27.3 语义一致（供上层阅读锚点）', () => {
    expect(STABLE_FRAMES).toBeGreaterThanOrEqual(2);
    expect(LOCK_FRAMES).toBeGreaterThanOrEqual(2);
    expect(RMS_OFF).toBeLessThan(RMS_ON);
  });

  it('sensToThresholds：边界夹紧、默认中庸偏稳、灵敏度越低阈值越高', () => {
    expect(sensToThresholds(MIC_SENS_MIN).rmsOn).toBeCloseTo(0.012, 4);
    expect(sensToThresholds(MIC_SENS_MAX).rmsOn).toBeCloseTo(0.048, 4);
    const def = sensToThresholds(DEFAULT_MIC_SENS);
    expect(def.rmsOn).toBeGreaterThan(0.02); // 老板嫌 0.02 太灵：默认回偏钝
    expect(def.rmsOff).toBeLessThan(def.rmsOn);
    const moreSensitive = sensToThresholds(10);
    const lessSensitive = sensToThresholds(90);
    expect(lessSensitive.rmsOn).toBeGreaterThan(moreSensitive.rmsOn);
    expect(lessSensitive.rmsOff).toBeGreaterThan(moreSensitive.rmsOff);
  });

  it('setThresholds：按覆盖后的能量阈判定（老板灵敏度，不影响既有运行态）', () => {
    const g = new OnsetGate();
    g.setThresholds(0.2, 0.05);
    const got = run(g, [
      [0.1, hz(69)], [0.1, hz(69)], // 0.1 < 0.2：弱于覆盖阈 → 不触发
      [0.4, hz(69)], [0.4, hz(69)], // 过 0.2 → 触发
    ]);
    expect(got).toEqual([false, false, false, true]);
  });
});
