import { describe, expect, it } from 'vitest';
import { yinPitch } from './yin';

/** 合成正弦窗（相位可任意；小幅噪底测试用 mix） */
function sine(sr: number, n: number, freq: number, amp = 0.5, phase = 0.3): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = amp * Math.sin(2 * Math.PI * freq * (i / sr) + phase);
  return b;
}

/** 确定性白噪（局部 LCG，避免测试偶发——audio 不依赖 generator） */
function noise(n: number, seed = 7): Float32Array {
  let s = seed >>> 0;
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    b[i] = (s / 2 ** 32 - 0.5) * 0.4;
  }
  return b;
}

/** 断言 f 非空且相对误差 < 0.5% */
function near(f: number | null, target: number): void {
  expect(f).not.toBeNull();
  expect(Math.abs((f as number) - target) / target).toBeLessThan(0.005);
}

describe('yinPitch 基频估计（§27.3）', () => {
  it('44.1k/48k 取样下纯正弦基频检出 ±0.5%', () => {
    for (const sr of [44100, 48000]) near(yinPitch(sine(sr, 2048, 440, 0.5), sr), 440);
  });

  it('出题音域边界：低音 G2≈98Hz、高音 G5≈784Hz 均检出', () => {
    near(yinPitch(sine(48000, 2048, 98, 0.6), 48000), 98);
    near(yinPitch(sine(48000, 2048, 784, 0.5), 48000), 784);
  });

  it('带小幅噪底的正弦仍检出', () => {
    const sr = 48000;
    const base = sine(sr, 2048, 262, 0.45, 1.1); // C4≈262Hz
    const nz = noise(2048, 3);
    const mix = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) mix[i] = base[i] + nz[i] * 0.05;
    near(yinPitch(mix, sr), 262);
  });

  it('静音 / 白噪 → null（无稳定基频）', () => {
    expect(yinPitch(new Float32Array(2048), 48000)).toBeNull();
    expect(yinPitch(noise(2048), 48000)).toBeNull();
  });

  it('过短窗 / 非法取样率 → null', () => {
    expect(yinPitch(new Float32Array(4), 48000)).toBeNull();
    expect(yinPitch(sine(48000, 2048, 440), 0)).toBeNull();
  });
});
