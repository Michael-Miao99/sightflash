import { useApp } from '../app/state';
import { defaultState } from '../core/storage/logic';
import { THEMES } from './themes';

export function SettingsScreen() {
  const { state, setState, repo, go } = useApp();
  return (
    <main className="screen settings">
      <h1>设置</h1>
      <div className="card">
        <div className="row"><span>声音</span>
          <button className="sel small" onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, sound: !p.settings.sound } }))}>
            {state.settings.sound ? '开' : '关'}
          </button>
        </div>
        <div className="row"><span>练黑键（变化音）</span>
          <button className="sel small" data-testid="gamut-toggle" onClick={() => setState((p) => ({
            ...p, settings: { ...p.settings, gamut: (p.settings.gamut ?? 'natural') === 'chromatic' ? 'natural' : 'chromatic' },
          }))}>
            {(state.settings.gamut ?? 'natural') === 'chromatic' ? '开' : '关'}
          </button>
        </div>
        <div className="row"><span>每轮时长</span>
          {[30, 60].map((d) => (
            <button key={d} className="sel small" onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, durationSec: d } }))}>
              {d}s{state.settings.durationSec === d ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <div className="row"><span>主题</span>
          {THEMES.map((t) => (
            <button key={t.id} className="sel small" data-testid={`theme-${t.id}`}
              onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, theme: t.id } }))}>
              {t.label}{state.settings.theme === t.id ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <button className="danger" onClick={async () => {
          if (!window.confirm('确定清除全部本地数据？进度、连续天数与练习记录都会被清空。')) return;
          try {
            await repo.clearAll();
            setState(() => defaultState());
          } catch (e) {
            console.warn('clearAll failed', e);
          }
        }}>清除本地数据</button>
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
