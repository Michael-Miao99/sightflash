import { AppProvider, useApp } from './state';
import type { SeedState } from './state';
import { HomeScreen } from '../ui/HomeScreen';
import { SetupScreen } from '../ui/SetupScreen';
import { PracticeScreen } from '../ui/PracticeScreen';
import { ResultScreen } from '../ui/ResultScreen';
import { StatsScreen } from '../ui/StatsScreen';
import { SettingsScreen } from '../ui/SettingsScreen';

export function AppRoot({ repoKind, seed }: { repoKind?: 'memory' | 'auto'; seed?: SeedState }) {
  return (
    <AppProvider repoKind={repoKind} seed={seed}>
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
