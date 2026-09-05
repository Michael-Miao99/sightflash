export type SoundKind = 'ok' | 'bad';

interface WebAudioGlobal {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

/**
 * 判定反馈提示音：ok=短促正弦高音，bad=低沉方波短音。
 * 仅在 enabled（设置里提示音开）且环境有 WebAudio 时发声；
 * jsdom/Node/旧浏览器或音频失败时静默返回，绝不影响训练。
 * 读取发生在调用时（非 import 时），便于测试注入 AudioContext。
 */
export function playFeedback(enabled: boolean, kind: SoundKind): void {
  if (!enabled) return;
  const g = globalThis as unknown as WebAudioGlobal;
  const AC = g.AudioContext ?? g.webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const ok = kind === 'ok';
    osc.type = ok ? 'sine' : 'square';
    osc.frequency.value = ok ? 880 : 196; // 答对 880Hz(A5)，答错 196Hz(G3)
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(ok ? 0.15 : 0.1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (ok ? 0.15 : 0.25));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (ok ? 0.18 : 0.3));
    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    /* 音频不可用：静默 */
  }
}
