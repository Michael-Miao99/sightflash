// 起音门状态机（§27.3）：输入逐帧 (rms, pitchHz)，判定"一次新的弹奏"，输出约化事件 {midi,cents}。
// 无浏览器依赖，可脚本化单测。帧假设 ≈ 一个 AnalyserNode 窗（2048 帧 @48k ≈ 43ms）。
// 规则：静音→能量过阈+音高稳定（连续 STABLE_FRAMES、漂移≤CENTS_LOCK）才判为一次弹奏；
// 触发后闭锁 LOCK_FRAMES 防同键释放重采；松键（rms<RMS_OFF）或换到 ≥PITCH_CHANGE_SEMI 的新音才允许再次触发。
import { roundToMidi, centsBetween } from './pitch';

export interface OnsetEvent {
  /** 取整到最近半音的 MIDI */
  midi: number;
  /** 实际音高相对 midi 的音分偏移（-50..50） */
  cents: number;
}

// 能量阈默认锚（离线/单测）。产品路径由老板「麦克风灵敏度」换算后经 micSetGateSens 覆盖：
// 见 sensToThresholds / Settings.micSens（§28 后追加）。
export const RMS_ON = 0.02;          // 有音能量阈（进入候选）
export const RMS_OFF = 0.006;        // 静音阈（松键复位，低于它允许重触发）
export const STABLE_FRAMES = 2;      // 音高稳定所需连续帧（≈86ms@48ms/帧）
export const CENTS_LOCK = 25;        // 稳定判定内音高漂移上限(¢)
export const PITCH_CHANGE_SEMI = 1.5; // 换音判别的半音跨度（同键持续不重触发）
export const LOCK_FRAMES = 2;        // 触发后闭锁帧数（消抖，≈86ms）

// ---- 麦克风灵敏度（老板可调，0..100）：0=最灵敏（弱音易判、噪声易误触）、100=最钝（需弹响些）----
export const MIC_SENS_MIN = 0;
export const MIC_SENS_MAX = 100;
export const DEFAULT_MIC_SENS = 60; // ≈ RMS_ON 0.028（中庸偏稳；嫌误触往大调、嫌不灵往小调）

/** 灵敏度 → 能量阈（对数插值：低段精细）。rmsOff 按 0.3 倍跟动并夹紧，保证 off 恒 < on。 */
export function sensToThresholds(sens: number): { rmsOn: number; rmsOff: number } {
  const s = Math.max(MIC_SENS_MIN, Math.min(MIC_SENS_MAX, sens));
  const rmsOn = +(0.012 * Math.pow(4, s / 100)).toFixed(4); // 0.012(灵) … 0.048(钝)
  const rmsOff = Math.min(0.016, Math.max(0.004, +(rmsOn * 0.3).toFixed(4)));
  return { rmsOn, rmsOff };
}

type Stage = 'idle' | 'candidate' | 'locked';

export class OnsetGate {
  private stage: Stage = 'idle';
  private candidateRuns = 0;             // 同音候选已连续帧数
  private pending: number[] = [];        // 候选帧的浮点 MIDI（稳定度参考）
  private lockLeft = 0;
  private soundingMidi: number | null = null; // 最近有效音的浮点 MIDI（换音/同键参考）
  private rmsOn = RMS_ON;                // 有音能量阈（可经 setThresholds 按灵敏度覆盖）
  private rmsOff = RMS_OFF;              // 静音阈

  /** 覆盖能量阈（老板灵敏度换算而来）；不清运行态，仅影响后续判定 */
  setThresholds(rmsOn: number, rmsOff: number): void {
    this.rmsOn = rmsOn;
    this.rmsOff = rmsOff;
  }

  reset(): void {
    this.stage = 'idle';
    this.candidateRuns = 0;
    this.pending = [];
    this.lockLeft = 0;
    this.soundingMidi = null;
  }

  /** 喂一帧 (rms, pitchHz)；产出一次起音事件则返回它，否则 null。 */
  feed(rms: number, pitchHz: number | null): OnsetEvent | null {
    // 静音/能量过低 → 松键复位（清 soundingMidi，允许同音再触发）
    if (rms < this.rmsOff) {
      this.candidateRuns = 0;
      this.pending = [];
      this.stage = 'idle';
      this.soundingMidi = null;
      return null;
    }
    // 弱能量（off..on）或无稳定音高（噪声/说话/瞬态）→ 候选不成立，不算松键
    if (rms < this.rmsOn || pitchHz === null || !Number.isFinite(pitchHz)) {
      this.candidateRuns = 0;
      this.pending = [];
      return null;
    }

    const fMidi = 69 + 12 * Math.log2(pitchHz / 440); // 浮点 MIDI（与 pitch 同式，勿引歧义）

    if (this.stage === 'locked') {
      // 闭锁期：只监听"换到 ≥PITCH_CHANGE_SEMI 的新音"以提前开门，其余一律忽略
      if (this.soundingMidi !== null && Math.abs(fMidi - this.soundingMidi) >= PITCH_CHANGE_SEMI) {
        this.stage = 'candidate';
        this.candidateRuns = 1;
        this.pending = [fMidi];
      } else if (--this.lockLeft <= 0) {
        this.stage = 'idle';
      }
      return null;
    }

    if (this.stage === 'candidate') {
      // 稳定性：与候选首帧漂移≤CENTS_LOCK 才累计；突跳（新音太快）则以新音重计
      if (Math.abs(centsBetween(fMidi, this.pending[0])) <= CENTS_LOCK) {
        this.candidateRuns++;
        this.pending.push(fMidi);
        if (this.candidateRuns >= STABLE_FRAMES) {
          const evt = this.emit(fMidi);
          this.stage = 'locked';
          this.lockLeft = LOCK_FRAMES;
          return evt;
        }
        return null;
      }
      this.candidateRuns = 1;
      this.pending = [fMidi];
      return null;
    }

    // idle：有能量且稳定音高 → 进候选；但同键持续（sounding 未清、音高没换）不重开门
    if (this.soundingMidi !== null && Math.abs(fMidi - this.soundingMidi) < PITCH_CHANGE_SEMI) {
      return null;
    }
    this.stage = 'candidate';
    this.candidateRuns = 1;
    this.pending = [fMidi];
    return null;
  }

  private emit(fMidi: number): OnsetEvent {
    const midi = roundToMidi(fMidi);
    const cents = Math.round((fMidi - midi) * 100);
    this.soundingMidi = fMidi;
    return { midi, cents };
  }
}
