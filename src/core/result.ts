export interface ResultSummary {
  correct: number;
  total: number;
  durationSec: number;
  /** 每分钟正确数，保留 1 位 */
  speed: number;
  /** 准确率百分比（整数） */
  accuracy: number;
}

export function computeResult(correct: number, total: number, durationSec: number): ResultSummary {
  const speed = durationSec > 0 ? Math.round((correct / (durationSec / 60)) * 10) / 10 : 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, durationSec, speed, accuracy };
}

/** 达标即升阶（门槛：准确率 ≥85） */
export function shouldAdvanceStage(r: { accuracy: number }): boolean {
  return r.accuracy >= 85;
}
