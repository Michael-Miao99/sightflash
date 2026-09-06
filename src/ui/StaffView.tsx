import { layoutStaffNote } from '../core/notation/positions';
import type { Clef } from '../core/notation/positions';
import { letterMidiOf } from '../core/notation/note';
import type { Accidental } from '../core/notation/note';

const SPACE = 16; // px / 谱表步
const VIEW_STEPS = 17; // viewBox 高 = 17 步 = 272px
const ANCHOR_STEP = 13; // y=0（顶边）对应的谱表步；step 越往下越小
const SVG_W = 320;
const LINES = [0, 2, 4, 6, 8]; // 五条线自下而上：步 0 底线(E4/G2) ~ 步 8 顶线(F5/A3)
const clefGlyph: Record<Clef, string> = { treble: '𝄞', bass: '𝄢' };
const ACC_GLYPH: Record<Accidental, string> = { '#': '♯', b: '♭' };

// SVG y 向下增长；谱表步越大音越高、画得越靠上，故 y 越小。
const stepToY = (s: number) => (ANCHOR_STEP - s) * SPACE;

/** 五线谱音符。acc 为变化音拼写：画谱恒用「拼写字母所在自然音」letterMidi 定位
 *  （positions 仍是自然语义），记号 ♯/♭ 画在符头左侧。acc 缺省/空 = 自然音。 */
export function StaffView({ midi, clef, acc }: { midi: number; clef: Clef; acc?: Accidental | null }) {
  const lm = letterMidiOf(midi, acc ?? null); // 拼写字母所在音（自然音）
  const { step, ledgerLines } = layoutStaffNote(lm, clef);
  const H = VIEW_STEPS * SPACE;
  const cy = stepToY(step);
  return (
    <div className="staff-wrap">
      <svg data-testid="staff" viewBox={`0 0 ${SVG_W} ${H}`} style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }}>
        {/* 谱号：基线大致落在谱中央附近 */}
        <text data-testid="clef" x={14} y={stepToY(clef === 'treble' ? 2 : 0) + 6} fontSize={52}
          style={{ fill: 'var(--staff-soft)' }} fontFamily="'Noto Music','Segoe UI Symbol',serif">
          {clefGlyph[clef]}
        </text>
        {LINES.map((l) => (
          <line key={l} className="staff-line" x1={60} x2={SVG_W - 16} y1={stepToY(l)} y2={stepToY(l)}
            style={{ stroke: 'var(--staff-line)' }} strokeWidth={1.5} />
        ))}
        {acc != null && (
          <text data-testid="accidental" x={182} y={cy + 8} textAnchor="end" fontSize={30}
            style={{ fill: 'var(--staff-note)' }} fontFamily="'Noto Music','Segoe UI Symbol',serif">
            {ACC_GLYPH[acc]}
          </text>
        )}
        {ledgerLines.map((l) => (
          <line key={l} className="ledger" x1={186} x2={246} y1={stepToY(l)} y2={stepToY(l)}
            style={{ stroke: 'var(--staff-soft)' }} strokeWidth={1.5} />
        ))}
        <ellipse className="note-head" cx={216} cy={cy} rx={10} ry={8} style={{ fill: 'var(--staff-note)' }}
          transform={`rotate(-20 216 ${cy})`} />
        <line x1={224} x2={228} y1={cy - 4} y2={cy - 46} style={{ stroke: 'var(--staff-note)' }} strokeWidth={2.5} />
      </svg>
    </div>
  );
}
