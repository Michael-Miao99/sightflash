import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { createSession, answerTap, answerKey } from '../core/session';
import { finalizeSession } from '../core/finalize';
import { mulberry32 } from '../core/generator/generator';
import { spelledName, LETTER_PC } from '../core/notation/note';
import { playPiano } from './piano.ts';
import { requestLandscape } from './landscape';
import { StaffView } from './StaffView';
import { GrandStaffView } from './GrandStaffView';
import { NoteButton } from './NoteButton';
import { Piano } from './Piano.tsx';

const ROTATE_HINT_BASE = '横屏使用键位更宽 ↻';
const ROTATE_HINT_MANUAL = '请手动旋转手机 ↻';

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
  const cfg = { stage: state.progress.stage, clef: state.settings.lastClef, durationSec: state.settings.durationSec, gamut };
  const seed = useRef(Math.floor(Math.random() * 2 ** 31));
  const [sess, setSess] = useState(() =>
    createSession({ ...cfg, rng: mulberry32(seed.current), wrong: state.progress.wrong }),
  );
  const [left, setLeft] = useState(cfg.durationSec);
  const finished = useRef(false);
  const [hintMsg, setHintMsg] = useState(ROTATE_HINT_BASE);

  // 倒计时
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // 时间到 → 结算 → 落库（先落库成功再跳转，保证 ResultScreen 能读到最新记录）
  useEffect(() => {
    if (left > 0 || finished.current) return;
    finished.current = true;
    const now = new Date();
    const { progress, streak, daily, record } = finalizeSession(state, {
      correct: sess.correct, total: sess.total, durationSec: cfg.durationSec,
      history: sess.history, stage: cfg.stage, clef: cfg.clef, ts: now.getTime(),
    });
    repo.addSession(record)
      .catch((e) => console.warn('addSession failed', e))
      .finally(() => {
        setState((prev) => ({ ...prev, progress, streak, daily }));
        go('result');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const sound = state.settings.sound;

  // 音名板作答（按音级）：判对播目标音；判错播“所选音级 @ 谱面音符八度”的错音。
  function onTap(pc: number) {
    const target = sess.target.midi;
    const ok = pc === target % 12;
    playPiano(sound, ok ? target : Math.floor(target / 12) * 12 + pc);
    setSess((s) => answerTap(s, pc));
  }

  // 琴键作答：按下立即播该键音；判定交给 answerKey（精确八度）。
  function onKey(midi: number) {
    playPiano(sound, midi);
    setSess((s) => answerKey(s, midi));
  }

  // 横屏提示：点击尝试全屏/锁定横屏；浏览器不支持时改为“请手动旋转”的提示。
  function onRotateHint() {
    void requestLandscape().then((ok) => setHintMsg(ok ? ROTATE_HINT_BASE : ROTATE_HINT_MANUAL));
  }

  const fb = sess.last === null ? 'none' : sess.last.result === 'correct' ? 'ok' : 'bad'; // 对齐样式 .fb.ok/.fb.bad
  const fbText =
    sess.last === null
      ? '看谱，点出这个音的名字（按钮或琴键）'
      : sess.last.result === 'correct'
        ? '✓ 对！'
        : `✗ 是 ${spelledName(sess.target.midi, sess.target.acc)}`; // 错题回显用题面拼写（答错时 target 停留）
  const clefName = cfg.clef === 'mixed' ? '大谱表' : sess.target.clef === 'treble' ? '高音谱' : '低音谱';
  const chromatic = gamut === 'chromatic';
  const boardKeys = chromatic ? CHROMATIC_KEYS : NATURAL_KEYS;

  return (
    <main className="screen practice">
      <button type="button" className="rotate-hint" data-testid="rotate-hint" onClick={onRotateHint}>{hintMsg}</button>
      <div className="row space-between">
        <span>S{state.progress.stage} · {clefName}</span>
        <span className={left <= 5 ? 'timer warn' : 'timer'}>{left}s</span>
      </div>
      {cfg.clef === 'mixed' ? (
        <GrandStaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />
      ) : (
        <StaffView midi={sess.target.midi} clef={sess.target.clef} acc={sess.target.acc} />
      )}
      <div className={`fb ${fb}`} data-testid="feedback">
        {fbText}
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
