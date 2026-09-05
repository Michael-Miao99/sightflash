import { useApp } from '../app/state';
import { defaultState } from '../core/storage/logic';

export function SettingsScreen() {
  const { state, setState, repo, go } = useApp();
  return (
    <main className="screen settings">
      <h1>设置</h1>
      <div className="card">
        <div className="row"><span>提示音</span>
          <button className="sel small" onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, sound: !p.settings.sound } }))}>
            {state.settings.sound ? '开' : '关'}
          </button>
        </div>
        <div className="row"><span>每轮时长</span>
          {[30, 60].map((d) => (
            <button key={d} className="sel small" onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, durationSec: d } }))}>
              {d}s{state.settings.durationSec === d ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <button className="danger" onClick={async () => {
          await repo.clearAll();
          setState(() => defaultState());
        }}>清除本地数据</button>
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
