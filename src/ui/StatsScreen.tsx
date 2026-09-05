import { useEffect, useState } from 'react';
import { useApp } from '../app/state';
import { speedTrend, latestAccuracies, errorDistribution } from '../core/stats';
import { midiToName } from '../core/notation/note';
import type { SessionRecord } from '../core/storage/types';

export function StatsScreen() {
  const { go, repo, state } = useApp();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  useEffect(() => { void repo.listSessions().then(setSessions); }, [repo]);

  const trend = speedTrend(sessions).slice(-20);
  const acc = latestAccuracies(sessions);
  const errs = errorDistribution(state.progress.wrong).slice(0, 8);
  const maxSpeed = Math.max(1, ...trend.map((p) => p.value));
  const maxErr = Math.max(1, ...errs.map((e) => e.count));

  return (
    <main className="screen stats">
      <h1>练习数据</h1>
      <div className="card">
        <div className="label">速度趋势（音/分）</div>
        {trend.length === 0
          ? <div className="small">先完成一轮训练再来看曲线吧</div>
          : (
            <svg viewBox="0 0 300 100" className="chart">
              {trend.map((p, i) => {
                const x = trend.length > 1 ? (i / (trend.length - 1)) * 290 + 5 : 150;
                const y = 90 - (p.value / maxSpeed) * 80;
                return <circle key={i} cx={x} cy={y} r={3} fill="#38bdf8" />;
              })}
            </svg>
          )}
        <div className="small">{trend.length} 条记录</div>
      </div>
      <div className="card">
        <div className="label">最近准确率：{acc.length ? `${acc[acc.length - 1]}%` : '—'}</div>
      </div>
      <div className="card">
        <div className="label">常错音符</div>
        {errs.length === 0 && <div className="small">暂无错音，继续保持！</div>}
        {errs.map((e) => (
          <div key={e.midi} className="err-row">
            <span>{midiToName(e.midi)}</span>
            <div className="bar"><div className="bar-fill warn" style={{ width: `${(e.count / maxErr) * 100}%` }} /></div>
            <span>{e.count}</span>
          </div>
        ))}
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
