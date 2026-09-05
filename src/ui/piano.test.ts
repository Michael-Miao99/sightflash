import { afterEach, describe, expect, it, vi } from 'vitest';
import { midiHz, playPiano, __resetPianoForTest } from './piano';

function installFakeAudio() {
  const made: Array<{ src: Record<string, unknown>; buf: { data: Float32Array } }> = [];
  class FakeParam {
    value = 0;
    setValueAtTime(): void {}
    exponentialRampToValueAtTime(): void {}
  }
  class FakeGain {
    gain = new FakeParam();
    connect(_d?: unknown) { return this; }
  }
  class FakeContext {
    sampleRate = 48000;
    currentTime = 0;
    state: 'running' | 'suspended' = 'running';
    destination = {};
    createBuffer(_ch: number, length: number, sr: number) {
      // 真实 AudioBuffer 通过 getChannelData(ch) 暴露可写声道，fake 用同源的 data 存储实现之。
      const data = new Float32Array(length);
      const buf = {
        length,
        sampleRate: sr,
        data,
        getChannelData(ch: number) {
          if (ch !== 0) throw new Error('only mono');
          return data;
        },
      };
      Object.defineProperty(buf, 'duration', { value: length / sr });
      const record = { src: {} as Record<string, unknown>, buf: buf as unknown as { data: Float32Array } };
      made.push(record);
      return record.buf as unknown as AudioBuffer;
    }
    createBufferSource() {
      const src: Record<string, unknown> = {
        buffer: null,
        connect(_d?: unknown) { return this; },
        start() {},
        stop() {},
      };
      made[made.length - 1].src = src;
      return src as unknown as AudioBufferSourceNode;
    }
    createGain() { return new FakeGain() as unknown as GainNode; }
    resume(): Promise<void> { return Promise.resolve(); }
  }
  const AC = vi.fn(function (this: unknown) { return new FakeContext(); }) as unknown as typeof AudioContext;
  vi.stubGlobal('AudioContext', AC);
  return { AC, made };
}

afterEach(() => {
  __resetPianoForTest();
  vi.unstubAllGlobals();
});

describe('piano 引擎', () => {
  it('midiHz：A4(69)=440、C4(60)≈261.63', () => {
    expect(midiHz(69)).toBeCloseTo(440, 6);
    expect(midiHz(60)).toBeCloseTo(261.63, 1);
  });

  it('enabled=false 不创建 AudioContext（静默）', () => {
    const { AC } = installFakeAudio();
    playPiano(false, 60);
    expect(AC).not.toHaveBeenCalled();
  });

  it('enabled=true 生成一段非静音 buffer 并播放一次', () => {
    const { AC, made } = installFakeAudio();
    playPiano(true, 60);
    expect(AC).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(1);
    expect(made[0].src.start).toBeTypeOf('function');
    const data = made[0].buf.data;
    expect(data.some((v) => Math.abs(v) > 1e-4)).toBe(true); // 真的写入了波形
  });

  it('同一音高重复播放命中缓存（不再二次合成）', () => {
    const { made } = installFakeAudio();
    playPiano(true, 60);
    playPiano(true, 60);
    expect(made).toHaveLength(1); // 只 createBuffer 一次
  });

  it('无 WebAudio 环境静默返回不抛错', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playPiano(true, 60)).not.toThrow();
  });
});
