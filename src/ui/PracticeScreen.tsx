import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { createSession, answerTap, answerKey } from '../core/session';
import { finalizeSession } from '../core/finalize';
import { mulberry32 } from '../core/generator/generator';
import { midiToName, LETTER_PC } from '../core/notation/note';
import { playPiano } from './piano.ts';
import { StaffView } from './StaffView';
import { NoteButton } from './NoteButton';
import { Piano } from './Piano.tsx';

const PITCH_BUTTONS = Object.keys(LETTER_PC); // C→B 插入序（与 letter 按钮一致）

export function PracticeScreen() {
  const { state, setState, repo, go } = useApp();
  const cfg = { stage: state.progress.stage, clef: state.settings.lastClef, durationSec: state.settings.durationSec };
  const seed = useRef(Math.floor(Math.random() * 2 ** 31));
  const [sess, setSess] = useState(() =>
    createSession({ ...cfg, rng: mulberry32(seed.current), wrong: state.progress.wrong }),
  );
  const [left, setLeft] = useState(cfg.durationSec);
  const finished = useRef(false);

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

  // 音名按钮作答：判对播目标音；判错播“所选音名 @ 谱面音符八度”的错音。
  function onTap(label: string) {
    const pc = LETTER_PC[label];
    if (pc === undefined) return; // 防御：异常 label 直接忽略
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

  const fb = sess.last === null ? 'none' : sess.last.result === 'correct' ? 'ok' : 'bad'; // 对齐样式 .fb.ok/.fb.bad
  const fbText =
    sess.last === null
      ? '看谱，点出这个音的名字（按钮或琴键）'
      : sess.last.result === 'correct'
        ? '✓ 对！'
        : `✗ 是 ${midiToName(sess.last.expectedMidi)}`;
  const clefName = sess.target.clef === 'treble' ? '高音谱' : '低音谱';

  return (
    <main className="screen practice">
      <p className="rotate-hint" role="note" data-testid="rotate-hint">横屏使用键位更宽 ↻</p>
      <div className="row space-between">
        <span>S{state.progress.stage} · {clefName}</span>
        <span className={left <= 5 ? 'timer warn' : 'timer'}>{left}s</span>
      </div>
      <StaffView midi={sess.target.midi} clef={sess.target.clef} />
      <div className={`fb ${fb}`} data-testid="feedback">
        {fbText}
      </div>
      <div className="row">
        {PITCH_BUTTONS.map((b) => (
          <NoteButton key={b} label={b} onClick={() => onTap(b)} />
        ))}
      </div>
      <Piano clef={sess.target.clef} onKey={onKey} />
    </main>
  );
}
