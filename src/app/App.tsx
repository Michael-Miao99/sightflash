import { AppProvider, useApp } from './state';
import { HomeScreen } from '../ui/HomeScreen';

export function AppRoot({ repoKind }: { repoKind?: 'memory' | 'auto' }) {
  return (
    <AppProvider repoKind={repoKind}>
      <Shell />
    </AppProvider>
  );
}

export default AppRoot;

/** 各视图占位：Task 10/11 逐个替换为真实屏幕 */
function Shell() {
  const { ready, view } = useApp();
  if (!ready) return <div className="boot">载入中…</div>;
  switch (view) {
    case 'practice': return <div className="boot">练习视图（Task 10 接入）</div>;
    case 'result': return <div className="boot">结算视图（Task 10 接入）</div>;
    case 'setup': return <div className="boot">开始设置（Task 11 接入）</div>;
    case 'stats': return <div className="boot">数据视图（Task 11 接入）</div>;
    case 'settings': return <div className="boot">设置（Task 11 接入）</div>;
    case 'home':
    default: return <HomeScreen />;
  }
}
