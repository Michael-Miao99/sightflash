import { useApp } from '../app/state';
import { makeDay, DAILY_GOAL } from '../core/storage/logic';

export function HomeScreen() {
  const { state, go } = useApp();
  const done = state.daily.date === makeDay(new Date()) ? state.daily.correct : 0;
  const pct = Math.min(100, Math.round((done / DAILY_GOAL) * 100));
  return (
    <main className="screen home">
      <h1>🎼 五线速读</h1>
      <button className="big primary" onClick={() => go('setup')}>开始训练</button>
      <div className="card">🔥 连续 {state.streak.current} 天 · 阶段 S{state.progress.stage}</div>
      <div className="card">
        <div>今日目标：{done}/{DAILY_GOAL} 音</div>
        <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="row">
        <button className="ghost" onClick={() => go('stats')}>📊 数据</button>
        <button className="ghost" onClick={() => go('settings')}>⚙️ 设置</button>
      </div>
    </main>
  );
}
