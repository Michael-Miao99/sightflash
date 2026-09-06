import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { createSession, answerTap, answerKey, answerPlay, skipQuestion } from '../core/session';
import { finalizeSession } from '../core/finalize';
import { mulberry32 } from '../core/generator/generator';
import { spelledName, LETTER_PC, midiToName } from '../core/notation/note';
import { playPiano } from './piano.ts';
import { requestLandscape } from './landscape';
import { StaffView } from './StaffView';
import { GrandStaffView } from './GrandStaffView';
import { NoteButton } from './NoteButton';
import { Piano } from './Piano.tsx';
import { useMicPitch } from './useMicPitch';
import { matches, deviationLabel, roundToMidi } from '../core/audio/pitch';
import type { OnsetEvent } from '../core/audio/onset';

const ROTATE_HINT_BASE = '横屏使用键位更宽 ↻';
const ROTATE_HINT_MANUAL = '请手动旋转手机 ↻';
const PLAY_IDLE = '对着麦克风，弹出谱面上的音';

/** 音名板键定义：label 按钮文字；pc 判对音级；black 黑键键（双名、配色区分） */
interface BoardKey { label: string; pc: number; black: boolean; }

/** 自然 7 键：C…B（LETTER_PC 插入序，与既有按钮一致） */
const NATURAL_KEYS: BoardKey[] = Object.entries(LETTER_PC).map(([label, pc]) => ({ label, pc, black: false }));

/** 黑键 5 键双名：pc ∈{1,3,6,8,10}，等音同键同 pc */
const BLACK_KEY_LABELS: ReadonlyArray<[number, string]> = [
  [1, 'C#/Db'], [3, 'D#/Eb'], [6, 'F#/Gb'], [8, 'G#/Ab'], [10, 'A#/Bb'],
];

/** chromatic 12 键：按音级 0→11 排（C C# D D# E F F# G G# A A# B） */
const CHROMATIC_KEYS: BoardKey[] = (() => {
  const byPc = new Map<number, BoardKey>(NATURAL_KEYS.map((k) => [k.pc, k]));
  for (const [pc, label] of BLACK_KEY_LABELS) byPc.set(pc, { label, pc, black: true });
  return Array.from({ length: 12 }, (_, pc) => byPc.get(pc)!);
})();

/** 跟弹（play）反馈瞬态：text 为文案；kind 映射对错样式（tap 反馈不经此，直接由 sess.last 推导） */
type FbState = { kind: 'idle' | 'ok' | 'bad'; text: string };

export function PracticeScreen() {
  const { state, setState, repo, go } = useApp();
  const gamut = state.settings.gamut ?? 'natural'; // 老存档缺字段按 natural
  const mode = state.settings.lastMode ?? 'tap'; // 老存档缺字段按认音
  const isPlay = mode === 'play';
  const cfg = {
    stage: state.progress.stage,
    clef: state.settings.lastClef,
    durationSec: state.settings.durationSec,
    gamut,
    mode,
  };
  const seed = useRef(Math.floor(Math.random() * 2 ** 31));
  const [sess, setSess] = useState(() =>
    createSession({ ...cfg, rng: mulberry32(seed.current), wrong: state.progress.wrong }),
  );
  const [left, setLeft] = useState(cfg.durationSec);
  const finished = useRef(false);
  const [hintMsg, setHintMsg] = useState(ROTATE_HINT_BASE);

  // ---- 跟弹（play）专用瞬态：反馈 / 逃生 / 静默提示 / 实时听音 ----
  const [fb, setFb] = useState<FbState>({ kind: 'idle', text: isPlay ? PLAY_IDLE : '' });
  const [showHint, setShowHint] = useState(false);
  const [quiet, setQuiet] = useState(0);
  const wasRunning = useRef(false);
  const mic = useMicPitch({ onOnset: onPlayOnset }); // tap 不 request → 无起音事件；onPlayOnset 内又按 isPlay 双保险

  // 倒计时
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // 跟弹静默提示：换题复位；同题 10s 无起音 → 轻提示（不扣分不卡题，§27.7）
  useEffect(() => { setQuiet(0); }, [sess.target.midi]);
  useEffect(() => {
    if (!isPlay) return;
    const t = setInterval(() => setQuiet((q) => q + 1), 1000);
    return () => clearInterval(t);
  }, [isPlay]);
  const quietWarn = isPlay && !finished.current && quiet >= 10;

  // 流中断（后台/权限被撤）→ 提前结算：走同一条倒计时结算路径（§27.7）
  useEffect(() => {
    if (!isPlay) return;
    if (mic.status === 'running') wasRunning.current = true;
    if (wasRunning.current && mic.status !== 'running' && !finished.current) {
      setLeft(0); // timer 结算 effect 接管（含 mic.stop + finalize + go result）
    }
  }, [mic.status, isPlay]);

  // 时间到 → 结算 → 落库（先落库成功再跳转，保证 ResultScreen 能读到最新记录）
  useEffect(() => {
    if (left > 0 || finished.current) return;
    finished.current = true;
    const now = new Date();
    const { progress, streak, daily, record } = finalizeSession(state, {
      correct: sess.correct, total: sess.total, durationSec: cfg.durationSec,
      history: sess.history, stage: cfg.stage, clef: cfg.clef, mode, ts: now.getTime(),
    });
    if (isPlay) mic.stop(); // 练习结束统一释放（§27.3）
    repo.addSession(record)
      .catch((e) => console.warn('addSession failed', e))
      .finally(() => {
        setState((prev) => ({ ...prev, progress, streak, daily }));
        go('result');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  // 离开练习屏的唯一出口是结算 effect（已 if (isPlay) mic.stop()）；浏览器刷新/关闭由页面卸载自动释放流。
  // 注意：勿在此加"卸载即 mic.stop()"兜底 —— React StrictMode 开发态首挂会模拟一次卸载再重挂，
  // 会把校准页沿用进来的 running 流误杀，触发流中断提前结算（§27.3 沿用语义与它冲突）。
  const sound = state.settings.sound;

  // ---- 跟弹：起音 → 判题（首击成败，§27.2）----
  function onPlayOnset(e: OnsetEvent): void {
    if (!isPlay) return;
    const played = e.midi + e.cents / 100; // 实际音高（含音分偏差）
    const target = sess.target.midi;
    const ok = matches(played, target);
    playPiano(sound, ok ? target : e.midi); // 判对播目标音、判错播实际作答音（仅作确认，§20.2）
    setFb({ kind: ok ? 'ok' : 'bad', text: ok ? '✓ 对！' : deviationLabel(played, target) });
    setQuiet(0);
    setSess((s) => answerPlay(s, played));
  }

  // ---- 跟弹逃生（§27.5）：首击判错停留后出现 ----
  const stuck = isPlay && sess.last?.result === 'wrong';
  function onSkip() {
    setSess((s) => skipQuestion(s));
    setFb({ kind: 'idle', text: PLAY_IDLE });
    setShowHint(false);
    setQuiet(0);
  }

  // 音名板作答（按音级）：判对播目标音；判错播“所选音级 @ 谱面音符八度”的错音。（认音专用）
  function onTap(pc: number) {
    const target = sess.target.midi;
    const ok = pc === target % 12;
    playPiano(sound, ok ? target : Math.floor(target / 12) * 12 + pc);
    setSess((s) => answerTap(s, pc));
  }

  // 琴键作答：按下立即播该键音；判定交给 answerKey（精确八度）。（认音专用）
  function onKey(midi: number) {
    playPiano(sound, midi);
    setSess((s) => answerKey(s, midi));
  }

  // 横屏提示：点击尝试全屏/锁定横屏；浏览器不支持时改为“请手动旋转”的提示。
  function onRotateHint() {
    void requestLandscape().then((ok) => setHintMsg(ok ? ROTATE_HINT_BASE : ROTATE_HINT_MANUAL));
  }

  const clefName = cfg.clef === 'mixed' ? '大谱表' : cfg.clef === 'treble' ? '高音谱' : '低音谱';
  const chromatic = gamut === 'chromatic';
  const boardKeys = chromatic ? CHROMATIC_KEYS : NATURAL_KEYS;
  const fbClass = fb.kind === 'ok' ? 'ok' : fb.kind === 'bad' ? 'bad' : '';
  const staff =
    cfg.clef === 'mixed'
      ? <GrandStaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />
      : <StaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />;
  const liveText = mic.liveMidi === null ? '-' : midiToName(roundToMidi(mic.liveMidi));

  // ---- 认音（tap）：作答面 = 音名板 + 仿真琴键（与现状逐字一致）----
  if (!isPlay) {
    return (
      <main className="screen practice">
        <button type="button" className="rotate-hint" data-testid="rotate-hint" onClick={onRotateHint}>{hintMsg}</button>
        <div className="row space-between">
          <span>S{state.progress.stage} · {clefName}</span>
          <span className={left <= 5 ? 'timer warn' : 'timer'}>{left}s</span>
        </div>
        {staff}
        <div className={`fb ${sess.last === null ? 'none' : sess.last.result === 'correct' ? 'ok' : 'bad'}`} data-testid="feedback">
          {sess.last === null
            ? '看谱，点出这个音的名字（按钮或琴键）'
            : sess.last.result === 'correct'
              ? '✓ 对！'
              : `✗ 是 ${spelledName(sess.target.midi, sess.target.acc)}`}
        </div>
        <div className={`row note-keys${chromatic ? ' chromatic' : ''}`}>
          {boardKeys.map((k) => (
            <NoteButton key={k.label} label={k.label} variant={k.black ? 'black' : 'natural'} onClick={() => onTap(k.pc)} />
          ))}
        </div>
        <Piano onKey={onKey} />
      </main>
    );
  }

  // ---- 跟弹（play）：作答面 = 麦克风；隐藏音名板与仿真琴键 ----
  return (
    <main className="screen practice play">
      <button type="button" className="rotate-hint" data-testid="rotate-hint" onClick={onRotateHint}>{hintMsg}</button>
      <div className="row space-between">
        <span>S{state.progress.stage} · {clefName}</span>
        <span className={left <= 5 ? 'timer warn' : 'timer'}>{left}s</span>
      </div>
      {staff}
      <div className="mic-hud" data-testid="mic-hud">
        <div className="live" data-testid="live-name">
          现在听到：<span className="now">{liveText}</span>
        </div>
        <div className="mic-level" style={{ width: '70%', margin: '4px auto 0' }}>
          <div className="bar-fill" style={{ width: `${Math.round(mic.level * 100)}%` }} />
        </div>
      </div>
      <div className={`fb ${fbClass}`} data-testid="feedback">{fb.text}</div>
      {quietWarn && <div className="no-answer" data-testid="no-answer">没听到，请弹响该键</div>}
      {stuck && (
        <div className="escape-row" data-testid="escape-row">
          <button type="button" className="link" data-testid="escape-hint" onClick={() => setShowHint((v) => !v)}>
            {showHint ? '收起键位提示' : '键位提示'}
          </button>
          <button type="button" className="link" data-testid="escape-skip" onClick={onSkip}>下一题</button>
        </div>
      )}
      {showHint && stuck && (
        <div className="keyhint">
          <Piano onKey={() => { /* readonly */ }} readOnly highlight={sess.target.midi} />
        </div>
      )}
    </main>
  );
}
