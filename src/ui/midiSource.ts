// MIDI 键盘→起音 浏览器胶水（§29）。模块级单例，形态仿 micSource：设置页连接后 running，
// 跟弹开时若偏好 MIDI（settings.midiPrefer）则优先用它作答；note-on 即一次性起音，无需能量门/音高检测——
// 比麦克风干净（无噪声/无检测误差/无八度歧义）。Web MIDI 平台限制：桌面 Chrome/Edge 与 Android Chrome 支持；
// iOS Safari 不支持（iPhone 上该块显示不支持、跟弹仍走麦克风）。
// 浏览器胶水不做 jsdom 单测：Android/桌面 Chrome 真机验收 + 组件测试从下方 mock 本模块。
import type { OnsetEvent } from '../core/audio/onset';

export type MidiStatus = 'idle' | 'requesting' | 'running' | 'unsupported' | 'denied' | 'error';

export interface MidiHandlers {
  /** 一次起音（进判题，note-on） */
  onOnset(e: OnsetEvent): void;
}

let status: MidiStatus = 'idle';
const subs = new Set<() => void>();
let access: MIDIAccess | null = null;
let input: MIDIInput | null = null;
let handlers: MidiHandlers | null = null;

/** 此浏览器是否支持 Web MIDI（桌面 Chrome/Edge、Android Chrome；iOS Safari / jsdom 无） */
export function midiIsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

export function midiGetStatus(): MidiStatus {
  return status;
}

/** 当前连接设备的名称（无人性名给泛称；非 running 时无意义） */
export function midiGetDeviceName(): string {
  const n = input?.name?.trim() || input?.manufacturer?.trim();
  return n || 'MIDI 键盘';
}

/** 订阅模块状态变化；返回退订函数 */
export function midiSubscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

/** 挂载/卸载本屏回调（仅一份；Practice 挂、卸载清。断开→重连沿用同一 handlers） */
export function midiSetHandlers(h: MidiHandlers | null): void {
  handlers = h;
}

function setStatus(s: MidiStatus): void {
  status = s;
  subs.forEach((fn) => fn());
}

/** note-on（含部分设备把 note-off 发成 0x90+vel0 → 忽略；0x80 note-off 本就无需处理）即一次作答起音 */
function onMessage(ev: MIDIMessageEvent): void {
  const d = ev.data;
  if (!d || d.length < 3) return;
  if ((d[0] & 0xf0) === 0x90 && d[2] > 0) handlers?.onOnset({ midi: d[1], cents: 0 });
}

function pickInput(): MIDIInput | null {
  if (!access) return null;
  for (const p of access.inputs.values()) {
    if (p.type === 'input' && p.state === 'connected') return p; // 取第一个已连接输入
  }
  return null;
}

function attach(): void {
  input = pickInput();
  if (!input) {
    setStatus('idle'); // 授权后仍无已连接设备（老板未插键盘）→ idle，跟弹回落麦克风
    return;
  }
  input.onmidimessage = onMessage;
  // 本设备拔掉 → state 变化 → 复位（上层订阅感知 → 回落麦克风）；插上新设备不热切换（下一轮开跟弹生效）
  input.onstatechange = () => { if (input?.state === 'disconnected') midiStop(); };
  setStatus('running');
}

/**
 * 请求/连接 MIDI 键盘（设置页按钮或跟弹启动调用；Web MIDI 无授权弹窗、通常在任一上下文即 resolve）。
 * running 幂等返回。返回终态（同步语义：无设备立刻 idle，不挂起等待）。
 */
export async function midiRequest(): Promise<MidiStatus> {
  if (status === 'running') return 'running';
  if (!midiIsSupported()) { setStatus('unsupported'); return 'unsupported'; }
  if (status === 'requesting') return 'requesting'; // 已在请求：避免重复（请求中的终态经订阅通知）
  setStatus('requesting');
  try {
    const a = await navigator.requestMIDIAccess({ sysex: false });
    // 等待期间已被 midiStop / 他处复位 → 丢弃迟到结果
    if (midiGetStatus() !== 'requesting') { access = null; return midiGetStatus(); }
    access = a;
    attach();
    return status;
  } catch (e) {
    const name = (e as DOMException | undefined)?.name;
    access = null;
    if (name === 'NotAllowedError' || name === 'SecurityError') { setStatus('denied'); return 'denied'; }
    setStatus('error');
    return 'error';
  }
}

/** 断开并复位（设置页断开 / 跟弹关闭 / 结算卸载）。幂等。释放引用即交 GC（Web MIDI 无显式 close 类型）。 */
export function midiStop(): void {
  if (input) { input.onmidimessage = null; input.onstatechange = null; }
  input = null;
  if (access) access.onstatechange = null;
  access = null;
  setStatus('idle');
}
