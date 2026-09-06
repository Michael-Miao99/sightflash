import { computeResult, shouldAdvanceStage } from './result';
import { makeDay, applyStreak, applyDaily, registerMistake, registerCorrect } from './storage/logic';
import type { AppState, Mode, SessionRecord } from './storage/types';
import { MAX_STAGE } from './generator/stages';
import type { MixedClef } from './generator/stages';
import { computeWrongDeltas, type HistoryItem } from './session';

export interface FinalizeInput {
  /** 本轮作答统计 */
  correct: number;
  total: number;
  durationSec: number;
  /** 一局内全部作答（history[0] 最新） */
  history: HistoryItem[];
  /** 本轮开局时的阶段（写入记录的是"本轮练的阶段"） */
  stage: number;
  clef: MixedClef;
  /** 本轮模式（tap 认音 / play 跟弹）；缺省 'tap' 兼容既有调用 */
  mode?: Mode;
  /** 轮次结束时刻（ms） */
  ts: number;
}

export interface FinalizeResult {
  progress: AppState['progress'];
  streak: AppState['streak'];
  daily: AppState['daily'];
  /** 落库的会话记录（stage = 本轮练的阶段，非升阶后） */
  record: SessionRecord;
  /** 本轮是否升阶 */
  advanced: boolean;
}

/**
 * 一轮结束 → 落库所需的新状态。纯函数，便于单测。
 * 顺序不可改：先 registerMistake(toLearn) 再 registerCorrect(recalled)。
 * 对"中途答对过、结束仍错"的重叠音，加深后立即扣减 → 净效果不变（有意为之，勿"修复"成双加深）。
 */
export function finalizeSession(prev: AppState, input: FinalizeInput): FinalizeResult {
  const r = computeResult(input.correct, input.total, input.durationSec);
  const today = makeDay(new Date(input.ts));
  const { toLearn, recalled } = computeWrongDeltas(input.history);
  let progress = prev.progress;
  for (const m of toLearn) progress = registerMistake(progress, m);
  for (const m of recalled) progress = registerCorrect(progress, m);
  let advanced = false;
  if (shouldAdvanceStage(r) && progress.stage < MAX_STAGE) {
    progress = { ...progress, stage: progress.stage + 1 };
    advanced = true;
  }
  const streak = applyStreak(prev.streak, today);
  const daily = applyDaily(prev.daily, today, input.correct);
  const record: SessionRecord = {
    ts: input.ts, mode: input.mode ?? 'tap', clef: input.clef, stage: input.stage,
    correct: input.correct, total: input.total, durationSec: input.durationSec,
    speed: r.speed, accuracy: r.accuracy,
  };
  return { progress, streak, daily, record, advanced };
}
