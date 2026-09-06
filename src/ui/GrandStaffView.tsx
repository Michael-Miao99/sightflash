import { layoutStaffNote } from '../core/notation/positions';
import type { Clef } from '../core/notation/positions';
import { letterMidiOf } from '../core/notation/note';
import type { Accidental } from '../core/notation/note';

// —— 大谱表几何（规格 §25.2/§25.3，真机微调优先改这里 + index.css 的 .grand-staff svg）——
const SPACE = 8; // px / 谱表步（A2 内缩版式；单行 StaffView 用 16，此处按 ~155px 高预算收敛）
const ANCHOR_TOP = 26; // y=0（顶边）对应的全局步；y=(ANCHOR_TOP-g)*SPACE，g 越大越靠上
const TREBLE_OFFSET = 12; // 高音行底线(E4)在低音行底线(G2)之上的全局步；中央 C 两谱同高 ⇒ 连续轴
const W = 320;
const H = 240;
const STAFF_X1 = 76; // 五线左缘 x
const STAFF_X2 = W - 10; // 五线右缘 x
const CLEF_X = 52; // 谱号中心 x
const NOTE_X = 216; // 符头中心 x（与 StaffView 同列，便于心理对齐）
const RX = 7;
const RY = 6;
const STEM = 22; // 符干长（内部 px）
const LEDGER_X1 = 186; // 加线（与 StaffView 同列）
const LEDGER_X2 = 246;
const ACC_X = 182; // 记号 textAnchor=end（与 StaffView 同）
const LINE_STEPS = [0, 2, 4, 6, 8] as const; // 5 线局部步
const BASS_LINE_STEPS = LINE_STEPS; // 低音行全局 0..8
const TREBLE_LINE_STEPS = LINE_STEPS.map((s) => s + TREBLE_OFFSET); // 高音行全局 12..20
const CLEF_GLYPH: Record<Clef, string> = { treble: '𝄞', bass: '𝄢' };
const ACC_GLYPH: Record<Accidental, string> = { '#': '♯', b: '♭' };

/** SVG y 向下增长；全局步越大音越高、y 越小。 */
const stepY = (g: number) => (ANCHOR_TOP - g) * SPACE;

/** 大括号路径：两段外弓 + 中央回折小横，近似钢琴谱贯通括号。外缘 x0，外凸至 x0+22，回折段 x0+4..x0+14。 */
function bracePath(yTop: number, yBot: number): string {
  const mid = (yTop + yBot) / 2;
  const x0 = 8; // 括号外缘 x
  return [
    `M ${x0} ${yBot}`,
    `C ${x0 + 22} ${yBot}, ${x0 + 22} ${mid + 16}, ${x0 + 4} ${mid}`,
    `C ${x0 + 22} ${mid - 16}, ${x0 + 22} ${yTop}, ${x0} ${yTop}`,
    `M ${x0 + 4} ${mid} L ${x0 + 14} ${mid}`,
  ].join(' ');
}

/** 真钢琴大谱表（混合模式专用）：双行五线 + 贯通括号 + 高低双谱号，单音画在所属行。
 *  clef = 本音所属行（treble 高音行 / bass 低音行）；acc 沿用 §24 变化音拼写（画谱恒用拼写字母定位）。 */
export function GrandStaffView({ midi, clef, acc }: { midi: number; clef: Clef; acc?: Accidental | null }) {
  const lm = letterMidiOf(midi, acc ?? null); // 拼写字母所在音（自然音）
  const { step: localStep, ledgerLines } = layoutStaffNote(lm, clef); // 复用 positions 自然音几何
  const offset = clef === 'treble' ? TREBLE_OFFSET : 0;
  const g = localStep + offset; // 全局步
  const cy = stepY(g);
  return (
    <div className="grand-staff">
      <svg data-testid="grand-staff" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        {BASS_LINE_STEPS.map((s) => (
          <line key={`b${s}`} className="staff-line" x1={STAFF_X1} x2={STAFF_X2} y1={stepY(s)} y2={stepY(s)}
            style={{ stroke: 'var(--staff-line)' }} strokeWidth={1.5} />
        ))}
        {TREBLE_LINE_STEPS.map((s) => (
          <line key={`t${s}`} className="staff-line" x1={STAFF_X1} x2={STAFF_X2} y1={stepY(s)} y2={stepY(s)}
            style={{ stroke: 'var(--staff-line)' }} strokeWidth={1.5} />
        ))}
        {/* 贯通括号：横跨低音行底到高音行顶，画在线下作为整体框架 */}
        <path data-testid="brace" d={bracePath(stepY(TREBLE_OFFSET + 9), stepY(-2))} fill="none"
          style={{ stroke: 'var(--staff-soft)' }} strokeWidth={2.5} />
        {/* 双谱号：各居其行中部（行中线 = 局部步 4） */}
        <text data-testid="clef-bass" x={CLEF_X} y={stepY(4)} dominantBaseline="central" textAnchor="middle"
          fontSize={24} style={{ fill: 'var(--staff-soft)' }} fontFamily="'Noto Music','Segoe UI Symbol',serif">{CLEF_GLYPH.bass}</text>
        <text data-testid="clef-treble" x={CLEF_X} y={stepY(TREBLE_OFFSET + 4)} dominantBaseline="central" textAnchor="middle"
          fontSize={26} style={{ fill: 'var(--staff-soft)' }} fontFamily="'Noto Music','Segoe UI Symbol',serif">{CLEF_GLYPH.treble}</text>
        {acc != null && (
          <text data-testid="accidental" x={ACC_X} y={cy + 5} textAnchor="end" fontSize={15}
            style={{ fill: 'var(--staff-note)' }} fontFamily="'Noto Music','Segoe UI Symbol',serif">{ACC_GLYPH[acc]}</text>
        )}
        {ledgerLines.map((l) => {
          const lg = l + offset; // 加线局部步 → 全局步（中央 C 两谱共全局 10）
          return (
            <line key={l} className="ledger" x1={LEDGER_X1} x2={LEDGER_X2} y1={stepY(lg)} y2={stepY(lg)}
              style={{ stroke: 'var(--staff-soft)' }} strokeWidth={1.5} />
          );
        })}
        <ellipse className="note-head" cx={NOTE_X} cy={cy} rx={RX} ry={RY} style={{ fill: 'var(--staff-note)' }}
          transform={`rotate(-20 ${NOTE_X} ${cy})`} />
        <line x1={NOTE_X + 8} x2={NOTE_X + 12} y1={cy - 3} y2={cy - 3 - STEM} style={{ stroke: 'var(--staff-note)' }} strokeWidth={2} />
      </svg>
    </div>
  );
}
