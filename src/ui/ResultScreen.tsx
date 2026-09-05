import { useEffect, useState } from 'react';
import { useApp } from '../app/state';
import { makeDay } from '../core/storage/logic';
import type { SessionRecord } from '../core/storage/types';

export function ResultScreen() {
  const { go, repo, state } = useApp();
  const [last, setLast] = useState<SessionRecord | null>(null);
  useEffect(() => {
    void repo.listSessions().then((all) => {
      if (all.length) setLast(all[all.length - 1]); // 最新记录在末位
    });
  }, [repo]);
  const today = makeDay(new Date());
  return (
    <main className="screen result">
      <h1>本轮完成</h1>
      <div className="card">
        {last
          ? `正确 ${last.correct} 音 · ${last.speed} 音/分 · 准确率 ${last.accuracy}%`
          : '记录计算中…'}
      </div>
      <div className="card">
        今日打卡 {state.streak.lastDate === today ? '✓' : '·'} 连续 {state.streak.current} 天 · 当前 S{state.progress.stage}
      </div>
      <div className="row">
        <button className="primary" onClick={() => go('setup')}>再来一轮</button>
        <button className="ghost" onClick={() => go('home')}>返回</button>
      </div>
    </main>
  );
}
