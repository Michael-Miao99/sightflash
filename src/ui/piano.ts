import { midiToHz } from '../core/audio/pitch';

// WebAudio 加法合成钢琴音。无素材依赖；jsdom / 无 WebAudio / 设置关闭时静默。
interface WebAudioGlobal {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

/** MIDI 号 → 频率(Hz)。A4(69)=440 —— 收敛自 core/audio/pitch（§27.3，消双源） */
export const midiHz = midiToHz;

let ac: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

function getCtx(): AudioContext | null {
  const g = globalThis as unknown as WebAudioGlobal;
  const AC = g.AudioContext ?? g.webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ac) ac = new AC();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

/** 合成一个近似钢琴的单音 buffer：基频 + 泛音、轻微不谐、按音区指数衰减。 */
function buildPianoBuffer(ctx: AudioContext, midi: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const f0 = midiHz(midi);
  const tau1 = 1.5 * (262 / f0) ** 0.45; // 低音衰减慢、高音快
  const dur = Math.min(6, Math.max(1.2, tau1 * 4));
  const n = Math.ceil(dur * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const data = buf.getChannelData(0);
  const partials = 6;
  const inhar = 0.0003; // 不谐性系数：真实钢琴高次泛音略偏高
  let max = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (let p = 1; p <= partials; p++) {
      const f = f0 * p * (1 + inhar * p * p);
      s += (1 / p ** 1.8) * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / (tau1 / Math.sqrt(p)));
    }
    data[i] = s;
    const a = Math.abs(s);
    if (a > max) max = a;
  }
  if (max > 0.95) {
    const k = 0.95 / max;
    for (let i = 0; i < n; i++) data[i] *= k;
  }
  return buf;
}

/** 播放某音高钢琴音；enabled 关或无 WebAudio 时静默。每次都在用户手势内调用。 */
export function playPiano(enabled: boolean, midi: number): void {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const key = `${midi}@${ctx.sampleRate}`;
    let buf = bufferCache.get(key);
    if (!buf) {
      buf = buildPianoBuffer(ctx, midi);
      bufferCache.set(key, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + buf.duration);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + buf.duration);
  } catch {
    /* 音频失败静默，不影响训练 */
  }
}

/** 测试专用：清空缓存的 Context 与 buffer。勿在生产调用。 */
export function __resetPianoForTest(): void {
  ac = null;
  bufferCache.clear();
}
