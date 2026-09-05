import { layoutStaffNote } from '../core/notation/positions';
import type { Clef } from '../core/notation/positions';

const SPACE = 16; // px / 谱表步
const VIEW_STEPS = 17; // 纵向步数（覆盖 -5 ~ +11，含下加线与上加线）
const MARGIN_TOP = 5; // step0（底线）位于 y=80，向上留 5 步给谱号与符干
const SVG_W = 320;
const LINES = [0, 2, 4, 6, 8]; // 五条线的谱表步
const clefGlyph: Record<Clef, string> = { treble: '𝄞', bass: '𝄢' };

export function StaffView({ midi, clef }: { midi: number; clef: Clef }) {
  const { step, ledgerLines } = layoutStaffNote(midi, clef);
  const H = VIEW_STEPS * SPACE;
  const yOf = (s: number) => (MARGIN_TOP + s) * SPACE; // s 越大，屏幕 y 越大（越靠下）
  const cy = yOf(step);
  return (
    <div className="staff-wrap">
      <svg data-testid="staff" viewBox={`0 0 ${SVG_W} ${H}`} style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }}>
        {/* 谱号：基线大致落在谱中央附近 */}
        <text data-testid="clef" x={14} y={yOf(clef === 'treble' ? 2 : 0) + 6} fontSize={52}
          fill="#cbd5e1" fontFamily="'Noto Music','Segoe UI Symbol',serif">
          {clefGlyph[clef]}
        </text>
        {LINES.map((l) => (
          <line key={l} className="staff-line" x1={60} x2={SVG_W - 16} y1={yOf(l)} y2={yOf(l)}
            stroke="#64748b" strokeWidth={1.5} />
        ))}
        {ledgerLines.map((l) => (
          <line key={l} className="ledger" x1={186} x2={246} y1={yOf(l)} y2={yOf(l)}
            stroke="#cbd5e1" strokeWidth={1.5} />
        ))}
        <ellipse className="note-head" cx={216} cy={cy} rx={10} ry={8} fill="#f8fafc"
          transform={`rotate(-20 216 ${cy})`} />
        <line x1={224} x2={228} y1={cy - 4} y2={cy - 46} stroke="#f8fafc" strokeWidth={2.5} />
      </svg>
    </div>
  );
}
