import { useApp } from '../app/state';
import { clefUnlockStage } from '../core/generator/stages';
import type { MixedClef } from '../core/generator/stages';

const CLEFS: Array<{ key: MixedClef; label: string; locked: string }> = [
  { key: 'treble', label: '高音谱', locked: '' },
  { key: 'bass', label: '低音谱', locked: '（S2 解锁）' },
  { key: 'mixed', label: '高/低混合', locked: '（S3 解锁）' },
];

export function SetupScreen() {
  const { state, setState, go } = useApp();
  const stage = state.progress.stage;

  function start(clef: MixedClef) {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, lastClef: clef, lastMode: 'tap' } }));
    go('practice');
  }

  return (
    <main className="screen setup">
      <h1>开始训练</h1>
      <div className="card">当前阶段 S{stage} · 模式：认音</div>
      <div className="card">
        <div className="label">选择谱号</div>
        {CLEFS.map((c) => {
          const unlocked = stage >= clefUnlockStage(c.key);
          return (
            <button key={c.key} className="sel" disabled={!unlocked} onClick={() => start(c.key)}>
              {c.label} {unlocked ? '' : c.locked}
            </button>
          );
        })}
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
