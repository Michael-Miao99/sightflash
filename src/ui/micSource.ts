// 麦克风→音高 浏览器胶水（§27.3）。模块级媒体流单例：校准页 request 得流后沿用进练习屏，
// 练习结束（到点结算/离开/卸载）统一 micStop 释放——避免重复弹授权框；只实时处理、不上传、不留存（§10）。
// 浏览器胶水不做 jsdom 单测：真机验收（§27.8）+ 组件测试从下方 mock 本模块开始。
import { yinPitch } from '../core/audio/yin';
import { hzToMidi } from '../core/audio/pitch';
import { OnsetGate } from '../core/audio/onset';
import type { OnsetEvent } from '../core/audio/onset';

export type MicStatus = 'idle' | 'requesting' | 'running' | 'denied' | 'unsupported' | 'error';

export interface MicHandlers {
  /** 一次起音（进判题） */
  onOnset(e: OnsetEvent): void;
  /** 实时指示：音量 level(0..1)、当前识别音高浮点 MIDI（无声/未识别 null） */
  onLevel(level: number, midi: number | null): void;
}

interface AudioGlobal {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

let status: MicStatus = 'idle';
const subs = new Set<() => void>();
let ac: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let rafId = 0;
let frameNo = 0;
let sampleBuf: Float32Array<ArrayBuffer> | null = null;
let handlers: MicHandlers | null = null;
const gate = new OnsetGate();

export function micGetStatus(): MicStatus {
  return status;
}

/** 订阅模块状态变化；返回退订函数（useMicPitch 用） */
export function micSubscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

function setStatus(s: MicStatus): void {
  status = s;
  subs.forEach((fn) => fn());
}

function audioCtxClass(): (typeof AudioContext) | undefined {
  const g = globalThis as unknown as AudioGlobal;
  return g.AudioContext ?? g.webkitAudioContext;
}

function tick(): void {
  if (!ac || !analyser) return;
  rafId = requestAnimationFrame(tick);
  if (!handlers) return;
  if (++frameNo % 3 !== 0) return; // 采样+YIN 只在消费帧算（约 48ms 一次 ≈ AnalyserNode 2048 窗长），省 3× CPU
  if (!sampleBuf) sampleBuf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(sampleBuf);
  let acc = 0;
  for (let i = 0; i < sampleBuf.length; i++) acc += sampleBuf[i] * sampleBuf[i];
  const rms = Math.sqrt(acc / sampleBuf.length);
  const f0 = yinPitch(sampleBuf, ac.sampleRate);
  const evt = gate.feed(rms, f0);
  if (evt) handlers.onOnset(evt);
  handlers.onLevel(Math.min(1, rms * 3), f0 === null ? null : hzToMidi(f0));
}

/**
 * 请求/授权麦克风并开流（用户手势内调用；running/requesting 幂等返回）。返回终态。
 * getUserMedia({echoCancellation:false,noiseSuppression:false,autoGainControl:false})——原声真琴判定。
 */
export async function micRequest(): Promise<MicStatus> {
  if (status === 'running') return 'running';
  const nav = navigator as Navigator & { mediaDevices?: MediaDevices };
  const AC = audioCtxClass();
  if (!nav.mediaDevices?.getUserMedia || !AC) {
    setStatus('unsupported');
    return 'unsupported';
  }
  if (status === 'requesting') return 'requesting'; // 已在请求中：避免重复弹授权（请求 #1 的终态会经订阅通知）
  setStatus('requesting');
  // 授权请求前同步建 ctx 并尝试 resume：iOS Safari 须在用户手势内解锁 AudioContext
  //（await gUM 后再建会脱离手势、可能永久 suspended 且让下方流程悬挂），失败不阻塞主流程。
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    setStatus('error');
    return 'error';
  }
  void ctx.resume().catch(() => {});
  try {
    const st = await nav.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    // 等待期间已被 micStop/他处复位 → 丢弃迟到的授权流，避免孤儿 rAF 与麦克风指示灯常亮（§27.3）
    if (micGetStatus() !== 'requesting') {
      st.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
      return micGetStatus();
    }
    const src = ctx.createMediaStreamSource(st);
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    src.connect(an);
    ac = ctx;
    analyser = an;
    stream = st;
    gate.reset();
    frameNo = 0;
    if (ctx.state !== 'running') void ctx.resume().catch(() => {}); // 兜底：connect 后仍 suspended 再试一次
    setStatus('running');
    // 流中断（后台/权限被撤）→ 立即释放，UI 订阅可感知并提前结算（§27.7）
    for (const t of st.getAudioTracks()) {
      t.addEventListener('ended', () => { if (stream === st) micStop(); });
    }
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
    return 'running';
  } catch (e) {
    void ctx.close().catch(() => {});
    const name = (e as DOMException | undefined)?.name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') { setStatus('denied'); return 'denied'; }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') { setStatus('unsupported'); return 'unsupported'; }
    setStatus('error');
    return 'error';
  }
}

/** 挂载/卸载本屏的事件回调（仅一份；新屏挂载会覆盖，旧屏卸载清理）。running 且无循环时重启 rAF（校准→练习沿用流）。 */
export function micSetHandlers(h: MicHandlers | null): void {
  handlers = h;
  if (!h) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    return;
  }
  if (status === 'running' && !rafId) rafId = requestAnimationFrame(tick);
}

/** 释放媒体流并复位（练习到点结算 / 校准页离开回 setup）。幂等。 */
export function micStop(): void {
  setStatus('idle');
  cancelAnimationFrame(rafId);
  rafId = 0;
  handlers = null;
  gate.reset();
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  ac = null;
  analyser = null;
  sampleBuf = null;
}
