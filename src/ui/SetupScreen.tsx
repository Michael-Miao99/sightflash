import { useApp } from '../app/state';
import { clefUnlockStage } from '../core/generator/stages';
import type { MixedClef } from '../core/generator/stages';
import type { Mode } from '../core/storage/types';

const CLEFS: Array<{ key: MixedClef; label: string; locked: string }> = [
  { key: 'treble', label: '高音谱', locked: '' },
  { key: 'bass', label: '低音谱', locked: '（S2 解锁）' },
  { key: 'mixed', label: '高/低混合', locked: '（S3 解锁）' },
];
const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'tap', label: '认音' },
  { key: 'play', label: '跟弹' },
];
const MODE_NAME: Record<Mode, string> = { tap: '认音', play: '跟弹' };

export function SetupScreen() {
  const { state, setState, go } = useApp();
  const stage = state.progress.stage;
  const mode = state.settings.lastMode ?? 'tap'; // 里程碑 A 老档缺 lastMode → 兜底认音，分段选中态不落空（§24）
  const modeName = MODE_NAME[mode] ?? '认音'; // 老档缺字段兜底（§24 模式）

  function start(clef: MixedClef) {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, lastClef: clef } }));
    go(mode === 'play' ? 'calibrate' : 'practice'); // §27.4：跟弹先过校准
  }

  return (
    <main className="screen setup">
      <h1>开始训练</h1>
      <div className="card">当前阶段 S{stage} · 模式：{modeName}</div>
      <div className="card">
        <div className="label">选择模式</div>
        <div className="row mode-seg">
          {MODES.map((m) => (
            <button key={m.key} data-testid={`mode-${m.key}`} className="sel small"
              onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, lastMode: m.key } }))}>
              {m.label}{mode === m.key ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <div className="label" style={{ marginTop: 12 }}>选择谱号</div>
        {CLEFS.map((c) => {
          const unlocked = stage >= clefUnlockStage(c.key);
          return (
            <button key={c.key} className="sel" disabled={!unlocked} onClick={() => start(c.key)}>
              {c.label} {unlocked ? '' : c.locked}
            </button>
          );
        })}
        <div className="small" style={{ marginTop: 8 }}>
          {mode === 'play'
            ? '跟弹用真琴/麦克风：先授权并校准，再开始。'
            : '认音点按钮或仿真琴键即可，无需麦克风。'}
        </div>
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
