import { useApp } from '../app/state';
import { defaultState } from '../core/storage/logic';
import { DEFAULT_MIC_SENS, MIC_SENS_MAX, MIC_SENS_MIN } from '../core/audio/onset';
import { normalizeTheme, THEMES } from './themes';

/** 灵敏度三段语感标签（0..100） */
function sensTag(s: number): string {
  if (s <= 30) return '灵敏';
  if (s >= 70) return '稳健';
  return '适中';
}

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
        <div className="mic-sens">
          <div className="row space-between">
            <span>麦克风灵敏度（跟弹）</span>
            <span className="sens-tag" data-testid="mic-sens-tag">
              {sensTag(state.settings.micSens ?? DEFAULT_MIC_SENS)} · {state.settings.micSens ?? DEFAULT_MIC_SENS}
            </span>
          </div>
          <input
            type="range" min={MIC_SENS_MIN} max={MIC_SENS_MAX} step={1}
            aria-label="麦克风灵敏度" data-testid="mic-sens"
            value={state.settings.micSens ?? DEFAULT_MIC_SENS}
            onChange={(e) => setState((p) => ({ ...p, settings: { ...p.settings, micSens: Number(e.target.value) } }))}
          />
          <div className="sens-scale"><span>灵敏</span><span>适中</span><span>稳健</span></div>
        </div>
        <div className="row"><span>主题</span>
          {THEMES.map((t) => (
            <button key={t.id} className="sel small" data-testid={`theme-${t.id}`}
              onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, theme: t.id } }))}>
              {t.label}{normalizeTheme(state.settings.theme) === t.id ? ' ✓' : ''}
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
