import { afterEach, describe, expect, it, vi } from 'vitest';
import { playFeedback } from './sound';

interface FakeOscLike {
  type: string;
  frequency: { value: number };
  connect(): unknown;
  start(): void;
  stop(): void;
  onended: (() => void) | null;
}
interface FakeGainLike {
  gain: { setValueAtTime(): void; exponentialRampToValueAtTime(): void };
  connect(): unknown;
}

/**
 * 安装一个伪造的 AudioContext：每次 `new AudioContext()` 造一个 FakeContext，
 * 并把该次 createOscillator 创建的 oscillator 记入 made（每次 beep 恰好 1 ctx + 1 osc）。
 * FakeParam.value 初值 0 → 断言 frequency.value 被写入 880/196 即证明参数真正被设置。
 */
function installFakeContext() {
  const made: Array<{ ctx: { close(): Promise<void> }; osc: FakeOscLike }> = [];
  class FakeParam {
    value = 0;
    setValueAtTime(): void {}
    exponentialRampToValueAtTime(): void {}
  }
  class FakeOsc implements FakeOscLike {
    type = '';
    frequency = new FakeParam();
    connect(): FakeGain {
      return new FakeGain();
    }
    start(): void {}
    stop(): void {}
    onended: (() => void) | null = null;
  }
  class FakeGain implements FakeGainLike {
    gain = new FakeParam();
    connect(): FakeGain {
      return this;
    }
  }
  class FakeContext {
    currentTime = 0;
    destination = {};
    createOscillator(): FakeOsc {
      return new FakeOsc();
    }
    createGain(): FakeGain {
      return new FakeGain();
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
  }
  const AC = vi.fn(function (this: unknown) {
    const ctx = new FakeContext();
    ctx.createOscillator = function () {
      const osc = new FakeOsc();
      made.push({ ctx, osc });
      return osc;
    };
    return ctx;
  }) as unknown as typeof AudioContext;
  vi.stubGlobal('AudioContext', AC);
  return { AC, made };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('playFeedback', () => {
  it('settings 关闭时不创建 AudioContext（不发声）', () => {
    const { AC, made } = installFakeContext();
    playFeedback(false, 'ok');
    playFeedback(false, 'bad');
    expect(AC).not.toHaveBeenCalled();
    expect(made).toHaveLength(0);
  });

  it('答对：正弦 880Hz（短促高音）且恰好 1 个发声单元', () => {
    const { AC, made } = installFakeContext();
    playFeedback(true, 'ok');
    expect(AC).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(1);
    const osc = made[0].osc;
    expect(osc.type).toBe('sine');
    expect(osc.frequency.value).toBe(880); // 参数真正写入（初值 0，若未设置则不等于 880）
  });

  it('答错：方波 196Hz 低音，与答对明显区分', () => {
    const { AC, made } = installFakeContext();
    playFeedback(true, 'bad');
    expect(AC).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(1);
    const osc = made[0].osc;
    expect(osc.type).toBe('square');
    expect(osc.frequency.value).toBe(196); // 参数真正写入（初值 0）
    expect(osc.type).not.toBe('sine'); // 波型与答对不同
  });

  it('无 WebAudio 环境（jsdom/Node）静默返回不抛错', () => {
    // 不 stub AudioContext（vitest jsdom 默认无）
    expect(() => playFeedback(true, 'ok')).not.toThrow();
    expect(() => playFeedback(true, 'bad')).not.toThrow();
  });
});
