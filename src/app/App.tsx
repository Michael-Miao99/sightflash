import { AppProvider, useApp } from './state';
import { HomeScreen } from '../ui/HomeScreen';
import { SetupScreen } from '../ui/SetupScreen';
import { PracticeScreen } from '../ui/PracticeScreen';
import { ResultScreen } from '../ui/ResultScreen';
import { StatsScreen } from '../ui/StatsScreen';
import { SettingsScreen } from '../ui/SettingsScreen';

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
    case 'setup': return <SetupScreen />;
    case 'result': return <ResultScreen />;
    case 'stats': return <StatsScreen />;
    case 'settings': return <SettingsScreen />;
    case 'home':
    default: return <HomeScreen />;
  }
}
