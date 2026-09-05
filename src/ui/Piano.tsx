import { useMemo } from 'react';
import type { Clef } from '../core/notation/positions';

const BLACK_PC = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A#
/** 琴键窗口（含两端）：高音 C4~C6、低音 G2~G4。端点均为自然音白键，覆盖全部目标。 */
const RANGE: Record<Clef, [number, number]> = { treble: [60, 84], bass: [43, 67] };
const BLACK_W = 0.62; // 黑键宽 = 白键宽的 0.62

function naturals(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (!BLACK_PC.has(m % 12)) out.push(m);
  return out;
}
function blacks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (BLACK_PC.has(m % 12)) out.push(m);
  return out;
}

/** 仿真钢琴键盘：点击琴键（白/黑）回调 onKey(midi)。画出来由调用方决定发声与判定。 */
export function Piano({ clef, onKey }: { clef: Clef; onKey: (midi: number) => void }) {
  const [lo, hi] = RANGE[clef];
  const whites = useMemo(() => naturals(lo, hi), [lo, hi]);
  const blackList = useMemo(() => blacks(lo, hi), [lo, hi]);
  const whiteIdx = useMemo(() => new Map(whites.map((m, i) => [m, i])), [whites]);
  return (
    <div className="piano" role="group" aria-label="钢琴键盘">
      {whites.map((m) => (
        <div key={m} data-testid={`w-${m}`} data-midi={m} className="key white"
          onPointerDown={(e) => { e.preventDefault(); onKey(m); }} />
      ))}
      {blackList.map((m) => {
        const i = whiteIdx.get(m - 1) ?? 0; // 黑键左侧白键下标
        const left = ((i + 1 - BLACK_W / 2) / whites.length) * 100;
        const width = (BLACK_W / whites.length) * 100;
        return (
          <div key={m} data-testid={`b-${m}`} data-midi={m} className="key black"
            style={{ left: `${left}%`, width: `${width}%` }}
            onPointerDown={(e) => { e.preventDefault(); onKey(m); }} />
        );
      })}
    </div>
  );
}
