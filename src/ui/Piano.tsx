// 注意：与 ui/piano.ts（发声引擎）同基名异大小写。Windows 大小写不敏感下省略扩展名会误解析，
// 导入本组件须写 ./Piano.tsx、导入引擎须写 ./piano.ts。
import { useMemo } from 'react';

const BLACK_PC = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A#
/** 固定琴键窗口 C2~C6（midi 36–84，4 个整八度）：29 白键 / 20 黑键。
 *  端点均为自然音白键；窗口不随谱号切换，中央C(C4=60) 恒为正中第 15 白键
 *  （混合模式换谱时位置不动，作稳定参照）。完全覆盖题目音池（高 C4~G5 / 低 G2~C4）。 */
const LO = 36; // C2
const HI = 84; // C6
const MIDDLE_C = 60; // 中央C，唯一标注键：文字 "C4"
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

export interface PianoProps {
  onKey: (midi: number) => void;
  /** 只读展示：不响应按键（§27.5 [键位提示] 的非交互态） */
  readOnly?: boolean;
  /** 高亮某键（目标音）：该键加 .hl（光圈由 .piano .key.hl 样式呈现） */
  highlight?: number;
}

/** 仿真钢琴键盘：点击琴键（白/黑）回调 onKey(midi)。画出来由调用方决定发声与判定。
 *  仅中央C(C4) 白键标注文字 "C4"，其余琴键无任何额外标记。
 *  readOnly=true 时键不响应点击（pointer-events 收在 .piano.readonly 样式）；highlight 高亮目标键。 */
export function Piano({ onKey, readOnly = false, highlight }: PianoProps) {
  const whites = useMemo(() => naturals(LO, HI), []);
  const blackList = useMemo(() => blacks(LO, HI), []);
  const whiteIdx = useMemo(() => new Map(whites.map((m, i) => [m, i])), [whites]);
  return (
    <div className={`piano${readOnly ? ' readonly' : ''}`} role="group" aria-label="钢琴键盘">
      {whites.map((m) => (
        <div key={m} data-testid={`w-${m}`} data-midi={m}
          className={`key white${m === highlight ? ' hl' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!readOnly) onKey(m);
          }}>
          {m === MIDDLE_C && <span className="c4" data-testid="c4-marker">C4</span>}
        </div>
      ))}
      {blackList.map((m) => {
        const i = whiteIdx.get(m - 1) ?? 0; // 黑键左侧白键下标
        const left = ((i + 1 - BLACK_W / 2) / whites.length) * 100;
        const width = (BLACK_W / whites.length) * 100;
        return (
          <div key={m} data-testid={`b-${m}`} data-midi={m}
            className={`key black${m === highlight ? ' hl' : ''}`}
            style={{ left: `${left}%`, width: `${width}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!readOnly) onKey(m);
            }} />
        );
      })}
    </div>
  );
}
