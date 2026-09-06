import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { createSession, answerTap, answerKey, answerFirstShot, skipQuestion } from '../core/session';
import type { FirstShotAnswer } from '../core/session';
import { finalizeSession } from '../core/finalize';
import { mulberry32 } from '../core/generator/generator';
import { spelledName, LETTER_PC } from '../core/notation/note';
import { playPiano } from './piano.ts';
import { requestLandscape } from './landscape';
import { StaffView } from './StaffView';
import { GrandStaffView } from './GrandStaffView';
import { NoteButton } from './NoteButton';
import { Piano } from './Piano.tsx';
import { useMicPitch } from './useMicPitch';
import { AdvanceBlank } from './advanceBlank';
import type { OnsetEvent } from '../core/audio/onset';

const ROTATE_HINT_BASE = '横屏使用键位更宽 ↻';
const ROTATE_HINT_MANUAL = '请手动旋转手机 ↻';
// 认音/跟弹共用一句引导（§28 界面无差别）：弹出 = 真琴（跟弹）或屏上琴键，点出 = 音名板
const IDLE_HINT = '看谱，弹出或用音名点出这个音';
/** 判对停留窗：绿✓ 期间屏面不变，短暂停留再换题——上一音还有余音也不误判，前后两音不混淆（§28） */
const CORRECT_HOLD_MS = 350;

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

export function PracticeScreen() {
  const { state, setState, repo, go } = useApp();
  const gamut = state.settings.gamut ?? 'natural'; // 老存档缺字段按 natural
  const cfg = {
    stage: state.progress.stage,
    clef: state.settings.lastClef,
    durationSec: state.settings.durationSec,
    gamut,
  };
  const seed = useRef(Math.floor(Math.random() * 2 ** 31));
  const [sess, setSess] = useState(() =>
    createSession({ ...cfg, rng: mulberry32(seed.current), wrong: state.progress.wrong }),
  );
  const sessRef = useRef(sess);
  sessRef.current = sess; // 事件回调里读最新会话（避免依赖 setSess 结果才能判定）
  const [left, setLeft] = useState(cfg.durationSec);
  const finished = useRef(false);
  const [hintMsg, setHintMsg] = useState(ROTATE_HINT_BASE);

  // ---- 跟弹开关（§28 唯一入口）：开 → 授权监听麦克风、判分统一"首击成败"；关 → 认音原样 ----
  const [playOn, setPlayOn] = useState(false);
  const [micMsg, setMicMsg] = useState('');
  const [flash, setFlash] = useState(false); // 判对停留中：谱面仍旧音、显示绿✓
  const holding = useRef(false); // 停留窗内吞掉所有作答（旧音余音/补按）
  const holdTimer = useRef<number>(0);
  const everPlay = useRef(false); // 本轮是否开过跟弹（决定记录 mode=play）
  const wasRunning = useRef(false);

  // 换题消隐窗（§27 补）：判对推进/逃生换题后短窗内吞上一音余音起音（时序域，见 advanceBlank.ts）
  const blank = useRef(new AdvanceBlank());
  // 静默提示（跟弹）：同题 N 秒无作答 → 轻提示（不扣分不卡题）
  const [quiet, setQuiet] = useState(0);

  const sound = state.settings.sound;

  // 麦克风 handlers。真琴起音 → 统一首击判定（playOn 双保险：未开 / 关掉后模块不会来事件）
  function handleOnset(e: OnsetEvent) {
    if (!playOn || finished.current || holding.current) return;
    if (blank.current.blanked()) return; // 换题消隐窗内：旧音余音/重音头，非本题作答，丢弃
    const played = e.midi + e.cents / 100;
    submitFirst({ kind: 'onset', playedMidi: played }, false);
  }
  const mic = useMicPitch({ onOnset: handleOnset });

  // 倒计时
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // 跟弹静默提示：换题复位；开跟弹且麦克风在听时逐秒累计
  useEffect(() => { setQuiet(0); }, [sess.target.midi]);
  useEffect(() => {
    if (!playOn) return;
    const t = setInterval(() => setQuiet((q) => q + 1), 1000);
    return () => clearInterval(t);
  }, [playOn]);

  // 开关→授权（用户手势内）：开即 request；关即 stop。授权失败/流中断由状态订阅回弹开关（见下）
  function onToggleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const on = e.target.checked;
    if (finished.current) return;
    setPlayOn(on);
    if (!on) { mic.stop(); setMicMsg(''); return; }
    everPlay.current = true; // 开过即按 play 记录（§28 数据页）
    setMicMsg('');
    mic.request().catch(() => {}); // micSource 已吞错，兜底
  }

  // 麦克风终态仲裁：running=在听；requesting=授权中等待；其余（denied/unsupported/error/idle=中断）→ 自动关回并提示，
  // 不中断本轮认音（认音不依赖麦克风）。流中断不再提前结算（§28 取代旧 §27.7）。
  useEffect(() => {
    if (!playOn || finished.current) return;
    if (mic.status === 'running') { wasRunning.current = true; return; }
    if (mic.status === 'requesting') return; // 授权弹窗等待中
    setPlayOn(false);
    mic.stop();
    setMicMsg(
      mic.status === 'denied' ? '麦克风授权被拒，仍可用音名/琴键作答'
        : mic.status === 'unsupported' ? '此设备/浏览器不支持麦克风，仍可用音名/琴键作答'
          : mic.status === 'error' ? '麦克风出错，已关闭跟弹'
            : (wasRunning.current ? '麦克风中断，已自动关闭（可重新打开）' : ''),
    );
    wasRunning.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status, playOn]);

  // 时间到 → 结算 → 落库（先落库成功再跳转，保证 ResultScreen 能读到最新记录）
  useEffect(() => {
    if (left > 0 || finished.current) return;
    finished.current = true;
    clearTimeout(holdTimer.current);
    holding.current = false;
    mic.stop(); // 练习结束统一释放（幂等）
    const now = new Date();
    const { progress, streak, daily, record } = finalizeSession(state, {
      correct: sess.correct, total: sess.total, durationSec: cfg.durationSec,
      history: sess.history, stage: cfg.stage, clef: cfg.clef,
      mode: everPlay.current ? 'play' : 'tap', ts: now.getTime(),
    });
    repo.addSession(record)
      .catch((e) => console.warn('addSession failed', e))
      .finally(() => {
        setState((prev) => ({ ...prev, progress, streak, daily }));
        go('result');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  // 离开练习屏（结算跳 result / 其它卸载）统一停麦。StrictMode 首挂模拟卸载时未开麦，stop 幂等无害；
  // 本版已无"校准页沿用流"，卸载停麦不会误杀任何继续使用的流（§28 取代旧沿用语义）。
  useEffect(() => () => { clearTimeout(holdTimer.current); mic.stop(); }, []);

  // ---- 统一首击判分（§28）：只走 answerFirstShot 一处判题，ok 以返回会话定格为准 ----
  function submitFirst(src: FirstShotAnswer, wasOnset: boolean) {
    const nxt = answerFirstShot(sessRef.current, src);
    const ok = nxt.last?.result === 'correct';
    if (!wasOnset) {
      // 屏上作答合成反馈音：判对播目标音；判错播实际作答音（仅 pc 需补算八度，见下）
      const target = sessRef.current.target.midi;
      const actual = src.kind === 'pc' ? Math.floor(target / 12) * 12 + src.pc : src.kind === 'key' ? src.midi : target;
      playPiano(sound, ok ? target : actual);
    }
    if (!ok) { setSess(nxt); setQuiet(0); return; } // 首击错/试错错：定格停留，✗ 由派生反馈显示
    // 判对 → 绿✓ + 停留再换题；命中即记 pending（此刻 sess 未动，谱面仍旧音 + ✓）
    holding.current = true;
    setFlash(true);
    clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holding.current = false;
      setFlash(false);
      if (finished.current) return;
      blank.current.shield(); // 换题开消隐窗：吞上一音余音/重音头（§27 补）
      setSess(nxt);
      setQuiet(0);
    }, CORRECT_HOLD_MS);
  }

  // ---- 跟弹逃生（首击判错停留后出现 [下一题]）----
  const stuck = playOn && sess.last?.result === 'wrong' && sess.last.expectedMidi === sess.target.midi;
  function onSkip() {
    if (finished.current || holding.current) return;
    blank.current.shield(); // 逃生换题同开窗：吞旧音尾（§27 补）
    setSess((s) => skipQuestion(s));
    setFlash(false);
    setQuiet(0);
  }

  // 音名板作答（按音级）：跟弹开 → 统一首击；关 → 认音逐字现状
  function onBoardPc(pc: number) {
    if (finished.current || holding.current) return;
    const s = sessRef.current;
    const target = s.target.midi;
    if (playOn) { submitFirst({ kind: 'pc', pc }, false); return; }
    const ok = pc === target % 12;
    playPiano(sound, ok ? target : Math.floor(target / 12) * 12 + pc);
    setSess((ss) => answerTap(ss, pc));
    setQuiet(0);
  }

  // 琴键作答：跟弹开 → 统一首击（合成音由 submitFirst 播：对=该键/目标、错=该键）；关 → 按下即播该键音 + answerKey
  function onPianoKey(midi: number) {
    if (finished.current || holding.current) return;
    if (playOn) { submitFirst({ kind: 'key', midi }, false); return; }
    playPiano(sound, midi);
    setSess((ss) => answerKey(ss, midi));
    setQuiet(0);
  }

  // 横屏提示：点击尝试全屏/锁定横屏；浏览器不支持时改为“请手动旋转”的提示。
  function onRotateHint() {
    void requestLandscape().then((ok) => setHintMsg(ok ? ROTATE_HINT_BASE : ROTATE_HINT_MANUAL));
  }

  const clefName = cfg.clef === 'mixed' ? '大谱表' : cfg.clef === 'treble' ? '高音谱' : '低音谱';
  const chromatic = gamut === 'chromatic';
  const boardKeys = chromatic ? CHROMATIC_KEYS : NATURAL_KEYS;
  const staff =
    cfg.clef === 'mixed'
      ? <GrandStaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />
      : <StaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />;
  // 反馈派生（两种模式同一条逻辑，界面无差别）：判对停留中绿✓；last=对 → ✓；last=本题错 → ✗ 揭晓音名；其余引导
  const fbOk = flash || sess.last?.result === 'correct';
  const fbBad = !fbOk && sess.last?.result === 'wrong' && sess.last.expectedMidi === sess.target.midi;
  const quietWarn = playOn && mic.status === 'running' && !finished.current && !fbOk && quiet >= 10;

  return (
    <main className="screen practice">
      <button type="button" className="rotate-hint" data-testid="rotate-hint" onClick={onRotateHint}>{hintMsg}</button>
      <div className="row space-between">
        <span>S{state.progress.stage} · {clefName}</span>
        <span className="hud">
          <label className="mic-toggle" data-testid="mic-toggle">
            <input type="checkbox" checked={playOn} onChange={onToggleChange} aria-label="跟弹：用麦克风听真琴作答" />
            <span className="t-label">跟弹</span>
            <span className="t-track" aria-hidden="true"><span className="t-thumb" /></span>
          </label>
          <span className={left <= 5 ? 'timer warn' : 'timer'}>{left}s</span>
        </span>
      </div>
      {micMsg && <div className="mic-msg" data-testid="mic-msg">{micMsg}</div>}
      {staff}
      <div className={`fb ${fbOk ? 'ok' : fbBad ? 'bad' : 'none'}`} data-testid="feedback">
        {fbOk ? '✓ 对！' : fbBad ? `✗ 是 ${spelledName(sess.target.midi, sess.target.acc)}` : IDLE_HINT}
      </div>
      {quietWarn && <div className="no-answer" data-testid="no-answer">还没作答：弹出或用音名点出这个音</div>}
      {stuck && !flash && (
        <div className="escape-row" data-testid="escape-row">
          <button type="button" className="link" data-testid="escape-skip" onClick={onSkip}>下一题</button>
        </div>
      )}
      <div className={`row note-keys${chromatic ? ' chromatic' : ''}`}>
        {boardKeys.map((k) => (
          <NoteButton key={k.label} label={k.label} variant={k.black ? 'black' : 'natural'} onClick={() => onBoardPc(k.pc)} />
        ))}
      </div>
      <Piano onKey={onPianoKey} />
    </main>
  );
}
