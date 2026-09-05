import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { createSession, answerTap, computeWrongDeltas } from '../core/session';
import { mulberry32 } from '../core/generator/generator';
import { MAX_STAGE } from '../core/generator/stages';
import { computeResult, shouldAdvanceStage } from '../core/result';
import { makeDay, applyStreak, applyDaily, registerMistake, registerCorrect } from '../core/storage/logic';
import { midiToName } from '../core/notation/note';
import { StaffView } from './StaffView';
import { NoteButton } from './NoteButton';

const PITCH_BUTTONS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const BUTTON_PC: Record<(typeof PITCH_BUTTONS)[number], number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

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

  // 时间到 → 结算 → 落库（setState 触发 state.tsx 持久化）
  useEffect(() => {
    if (left > 0 || finished.current) return;
    finished.current = true;
    const r = computeResult(sess.correct, sess.total, cfg.durationSec);
    const now = new Date();
    const today = makeDay(now);

    // 错音池增量：未解决音加深，有答对的音出池
    const { toLearn, recalled } = computeWrongDeltas(sess.history);
    let progress = state.progress;
    for (const m of toLearn) progress = registerMistake(progress, m);
    for (const m of recalled) progress = registerCorrect(progress, m);

    // 升阶（任一完整轮次准确率 ≥85，封顶 S5）
    if (shouldAdvanceStage(r) && progress.stage < MAX_STAGE) progress = { ...progress, stage: progress.stage + 1 };

    const streak = applyStreak(state.streak, today);
    const daily = applyDaily(state.daily, today, sess.correct);
    void repo.addSession({
      ts: now.getTime(), mode: 'tap', clef: cfg.clef, stage: cfg.stage,
      correct: sess.correct, total: sess.total, durationSec: cfg.durationSec,
      speed: r.speed, accuracy: r.accuracy,
    });
    setState((prev) => ({ ...prev, progress, streak, daily }));
    go('result');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  function onTap(label: string) {
    const pc = BUTTON_PC[label as keyof typeof BUTTON_PC];
    setSess((s) => answerTap(s, pc));
  }

  const fb = sess.last === null ? 'none' : sess.last.result === 'correct' ? 'ok' : 'bad'; // 对齐样式 .fb.ok/.fb.bad
  const fbText =
    sess.last === null
      ? '看谱，点出这个音的名字'
      : sess.last.result === 'correct'
        ? '✓ 对！'
        : `✗ 是 ${midiToName(sess.last.expectedMidi)}`;
  const clefName = sess.target.clef === 'treble' ? '高音谱' : '低音谱';

  return (
    <main className="screen practice">
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
    </main>
  );
}
