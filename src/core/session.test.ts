import { describe, it, expect } from 'vitest';
import { createSession, answerTap, answerKey, answerFirstShot, skipQuestion, computeWrongDeltas } from './session';
import type { Session } from './session';
import { mulberry32 } from './generator/generator';
import { LETTER_PC } from './notation/note';

const pc = (letter: string) => LETTER_PC[letter]; // C→0 …

describe('session 会话状态机', () => {
  it('答对（音级匹配）：计数+1 并换下一题', () => {
    const s = createSession({ stage: 1, clef: 'treble', durationSec: 60, rng: mulberry32(1), wrong: {} });
    const t = s.target.midi;
    const next = answerTap(s, t % 12);
    expect(next.correct).toBe(1);
    expect(next.total).toBe(1);
    expect(next.history[0].result).toBe('correct');
  });

  it('答错：total+1、错音记入、题目停留', () => {
    const s = createSession({ stage: 1, clef: 'treble', durationSec: 60, rng: mulberry32(2), wrong: {} });
    const targetMidi = s.target.midi;
    const correctPc = targetMidi % 12;
    const wrongPc = correctPc === pc('C') ? pc('D') : pc('C'); // 保证答错
    const next = answerTap(s, wrongPc);
    expect(next.correct).toBe(0);
    expect(next.total).toBe(1);
    expect(next.target.midi).toBe(targetMidi); // 停留
    expect(next.history[0]).toMatchObject({ result: 'wrong', expectedMidi: targetMidi });
  });

  it('混合模式每道题携带明确的 clef', () => {
    const s = createSession({ stage: 5, clef: 'mixed', durationSec: 60, rng: mulberry32(3), wrong: {} });
    expect(['treble', 'bass']).toContain(s.target.clef);
  });

  it('computeWrongDeltas：结束仍错的音加深，答对过的音出池', () => {
    // history[0] 为最新（answerTap 前插）。C4 最新仍 wrong（进入 toLearn，但也答对过→recalled），G4 答对解决。
    const base = { result: 'wrong' as const, expectedMidi: 60, expectedPc: 0, actualPc: 2 };
    const hist = [
      { result: 'correct' as const, expectedMidi: 67, expectedPc: 7, actualPc: 7 },
      { ...base, result: 'wrong' as const },
      { result: 'correct' as const, expectedMidi: 60, expectedPc: 0, actualPc: 0 },
      { ...base },
    ];
    const d = computeWrongDeltas(hist);
    expect(d.toLearn).toEqual([60]); // C4 结束仍错 → 加深
    expect(d.recalled).toEqual([60, 67]); // C4/G4 本轮都答对过 → 出池
  });
});

function makeSession(targetMidi: number): Session {
  return {
    stage: 1,
    clef: 'treble',
    durationSec: 60,
    rng: () => 0.5,
    wrong: {},
    target: { midi: targetMidi, clef: 'treble' },
    correct: 0,
    total: 0,
    history: [],
    last: null,
  };
}

describe('answerKey 精确八度作答', () => {
  it('点到同一 MIDI 判对：计入正确、推进下一题', () => {
    const s = makeSession(60); // C4
    const next = answerKey(s, 60);
    expect(next.last?.result).toBe('correct');
    expect(next.correct).toBe(1);
    expect(next.total).toBe(1);
    expect(next.history[0]).toMatchObject({ expectedMidi: 60, actualPc: 0 });
    expect(next.target).not.toBe(s.target); // 推进到新题
  });

  it('同音名错八度（C5=72）判错：题目停留可重试', () => {
    const s = makeSession(60);
    const next = answerKey(s, 72);
    expect(next.last?.result).toBe('wrong');
    expect(next.correct).toBe(0);
    expect(next.total).toBe(1);
    expect(next.history[0].actualPc).toBe(0);
    expect(next.target).toBe(s.target); // 未推进
  });

  it('点黑键（如 C#4=61）对自然音目标恒判错', () => {
    const s = makeSession(62); // D4 自然音
    const next = answerKey(s, 61); // C#4
    expect(next.last?.result).toBe('wrong');
    expect(next.correct).toBe(0);
    expect(next.history[0].actualPc).toBe(1);
  });
});

describe('session 变化音 gamut 穿透', () => {
  it('chromatic 会话可出黑键目标且带合法 acc', () => {
    let s: Session | null = null;
    for (let seed = 1; seed < 400 && !s; seed++) {
      const c = createSession({ stage: 3, clef: 'treble', durationSec: 60, rng: mulberry32(seed), wrong: {}, gamut: 'chromatic' });
      if ([1, 3, 6, 8, 10].includes(c.target.midi % 12)) s = c;
    }
    expect(s).not.toBeNull();
    expect(['#', 'b']).toContain(s!.target.acc);
  });

  it('缺省 gamut 的老构造保持自然音行为、无 acc', () => {
    const s = createSession({ stage: 3, clef: 'treble', durationSec: 60, rng: mulberry32(1), wrong: {} });
    expect([0, 2, 4, 5, 7, 9, 11]).toContain(s.target.midi % 12);
    expect(s.target.acc).toBeUndefined();
  });

  it('黑键题答错按音级停留、答对推进', () => {
    let s: Session | null = null;
    for (let seed = 1; seed < 400 && !s; seed++) {
      const c = createSession({ stage: 3, clef: 'treble', durationSec: 60, rng: mulberry32(seed), wrong: {}, gamut: 'chromatic' });
      if ([1, 3, 6, 8, 10].includes(c.target.midi % 12)) s = c;
    }
    expect(s).not.toBeNull();
    const sess = s!;
    const midi = sess.target.midi;
    const wrong = answerTap(sess, (midi % 12 + 1) % 12); // 按音级错答
    expect(wrong.last?.result).toBe('wrong');
    expect(wrong.target.midi).toBe(midi); // 停留
    const ok = answerTap(wrong, midi % 12);
    expect(ok.last?.result).toBe('correct');
    expect(ok.correct).toBe(wrong.correct + 1);
    expect(ok.target).not.toBe(wrong.target); // 推进换新题对象
  });
});

describe('answerFirstShot 统一首击成败（跟弹开关，§27.2/§28）', () => {
  /** 起音面简写 */
  const onset = (s: Session, playedMidi: number) => answerFirstShot(s, { kind: 'onset', playedMidi });

  it('起音首击命中（±30¢）：correct+1、total+1、记录对、推进下一题', () => {
    const s = makeSession(60); // C4
    const next = onset(s, 60.2);
    expect(next.last?.result).toBe('correct');
    expect(next.correct).toBe(1);
    expect(next.total).toBe(1);
    expect(next.history[0]).toMatchObject({ result: 'correct', expectedMidi: 60, actualPc: 0 });
    expect(next.target).not.toBe(s.target); // 推进
  });

  it('起音首击偏 40¢ 判错：记错、停留、可重试', () => {
    const s = makeSession(60);
    const next = onset(s, 60.4); // 40¢ > 30¢ 容差
    expect(next.last?.result).toBe('wrong');
    expect(next.correct).toBe(0);
    expect(next.total).toBe(1);
    expect(next.history[0]).toMatchObject({ result: 'wrong', expectedMidi: 60 });
    expect(next.target).toBe(s.target); // 停留
  });

  it('起音首击弹错键(C5=72)判错；同题再错不增 total 不新增记录；终于弹对→推进且不新增记录', () => {
    const s = makeSession(60);
    const w = onset(s, 72);
    expect(w.history).toHaveLength(1);
    expect(w.total).toBe(1);

    const w2 = onset(w, 79); // 仍在错（试错，不扣分）
    expect(w2.correct).toBe(0);
    expect(w2.total).toBe(1); // 试错不增 total
    expect(w2.history).toHaveLength(1); // 不新增记录

    const ok = onset(w2, 60.1); // 终于弹对
    expect(ok.last?.result).toBe('correct'); // ✓ 反馈有
    expect(ok.correct).toBe(0); // 首击已定格为错 → correct 不再加
    expect(ok.total).toBe(1);
    expect(ok.history).toHaveLength(1); // 不新增记录
    expect(ok.target).not.toBe(w2.target); // 推进换新题
  });

  it('skipQuestion：停留的错题逃生→推进、total/history 不变、last 清空', () => {
    const s = makeSession(60);
    const w = onset(s, 72); // 首击错、停留
    const sk = skipQuestion(w);
    expect(sk.total).toBe(1);
    expect(sk.history).toHaveLength(1);
    expect(sk.correct).toBe(0);
    expect(sk.target).not.toBe(w.target); // 邻避：新目标 ≠ 旧目标
    expect(sk.last).toBeNull();
  });

  it('起音同音名错八度恒判错（±30¢≪半音 ⇒ 蕴含八度一致）', () => {
    const s = makeSession(60);
    const next = onset(s, 72); // C5（同音名高八度）
    expect(next.last?.result).toBe('wrong');
    expect(next.correct).toBe(0);
    expect(next.total).toBe(1);
  });

  it('相邻同音（rng 恒 0 → 邻避重抽上限命中 prev）时新题仍按首击判定（终审回归）', () => {
    // S1 高音 natural 池 [60,62,64]；rng=0 使 pickWeighted 恒取池首 → 答对推进后新题仍 60（相邻同音复现）。
    const s = createSession({ stage: 1, clef: 'treble', durationSec: 60, rng: () => 0, wrong: {} });
    expect(s.target.midi).toBe(60);
    const a = onset(s, 60.0); // 首题命中 → total+1、推进
    expect(a.total).toBe(1);
    expect(a.correct).toBe(1);
    expect(a.target.midi).toBe(60); // 相邻同音
    const b = onset(a, 60.0); // 必须是新题首击（不能当成停留题试错）
    expect(b.total).toBe(2);
    expect(b.correct).toBe(2);
    expect(b.history).toHaveLength(2);
  });

  it('音名板 pc 首击错→记错停留；再对推进且不重计（屏上点按同规则）', () => {
    const s = makeSession(60); // C4
    const w = answerFirstShot(s, { kind: 'pc', pc: 2 }); // 首击点 D
    expect(w.last?.result).toBe('wrong');
    expect(w.total).toBe(1);
    expect(w.history).toHaveLength(1);
    expect(w.target).toBe(s.target); // 停留
    const ok = answerFirstShot(w, { kind: 'pc', pc: 0 }); // 试错点 C
    expect(ok.last?.result).toBe('correct');
    expect(ok.correct).toBe(0); // 首击已定格错 → 不重计
    expect(ok.total).toBe(1);
    expect(ok.history).toHaveLength(1);
    expect(ok.target).not.toBe(w.target); // 推进
  });

  it('屏上琴键 key 同音名错八度首击判错、试错到对不重计', () => {
    const s = makeSession(60); // C4
    const w = answerFirstShot(s, { kind: 'key', midi: 72 }); // 首击按 C5
    expect(w.last?.result).toBe('wrong');
    expect(w.history[0].actualPc).toBe(0); // 同音名错八度，actualPc=C
    expect(w.total).toBe(1);
    expect(w.target).toBe(s.target);
    const ok = answerFirstShot(w, { kind: 'key', midi: 60 }); // 试错按 C4
    expect(ok.last?.result).toBe('correct');
    expect(ok.correct).toBe(0);
    expect(ok.total).toBe(1);
    expect(ok.target).not.toBe(w.target);
  });
});
