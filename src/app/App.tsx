import { AppProvider, useApp } from './state';
import { HomeScreen } from '../ui/HomeScreen';
import { PracticeScreen } from '../ui/PracticeScreen';
import { ResultScreen } from '../ui/ResultScreen';

export function AppRoot({ repoKind }: { repoKind?: 'memory' | 'auto' }) {
  return (
    <AppProvider repoKind={repoKind}>
      <Shell />
    </AppProvider>
  );
}

export default AppRoot;

function Shell() {
  const { ready, view } = useApp();
  if (!ready) return <div className="boot">载入中…</div>;
  switch (view) {
    case 'practice': return <PracticeScreen />;
    case 'result': return <ResultScreen />;
    case 'setup': return <div className="boot">开始设置（Task 11 接入）</div>;
    case 'stats': return <div className="boot">数据视图（Task 11 接入）</div>;
    case 'settings': return <div className="boot">设置（Task 11 接入）</div>;
    case 'home':
    default: return <HomeScreen />;
  }
}
