// 换题消隐窗（§27 补判题层）：判对推进 / 逃生跳题后的一小段时间内，起音门可能仍会
// 因"上一音没弹完"再触发一次起音（余音/重音头/松键回落），落到新题上会被误判错——
// 老板验收反馈：屏幕刚由 C4 换 C5，C4 音尾就被判错。此处把"距上次换题 <ADVANCE_BLANK_MS"
// 的起音一律丢弃。跟弹是逐音"看谱→弹→判"，单音作答周期远大于该窗，不误伤下一题首击；
// 与 OnsetGate 分工：gate 管"同一音高持续不重触发"（持续域），本窗管"换题边界"（时序域）。
export const ADVANCE_BLANK_MS = 250;

/** 记录最近一次换题时刻，判定"此刻到达的起音是否应丢弃"。纯逻辑、无浏览器依赖，可单测。 */
export class AdvanceBlank {
  private lastAdvanceAt = -Infinity;
  private readonly now: () => number;
  private readonly blankMs: number;

  constructor(now: () => number = () => Date.now(), blankMs: number = ADVANCE_BLANK_MS) {
    this.now = now;
    this.blankMs = blankMs;
  }

  /** 换题（判对推进 / 逃生跳题）后调用：从此刻起 blankMs 内的起音视为旧音余音 */
  shield(): void {
    this.lastAdvanceAt = this.now();
  }

  /** 当前到达的起音是否在换题静默窗内（应丢弃） */
  blanked(): boolean {
    return this.now() - this.lastAdvanceAt < this.blankMs;
  }
}
