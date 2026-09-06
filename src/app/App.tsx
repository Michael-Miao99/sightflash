import { useEffect } from 'react';
import { AppProvider, useApp } from './state';
import type { SeedState } from './state';
import { normalizeTheme, mirrorTheme } from '../ui/themes';
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
      <ThemeSync />
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

/** 主题同步：settings.theme（真源）→ <html data-theme> + localStorage 首帧镜像。
 *  mount 即设一次（含老档缺字段回落的 paper），后续仅 theme 变化时重设。 */
function ThemeSync() {
  const { state } = useApp();
  const theme = normalizeTheme(state.settings.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    mirrorTheme(theme);
  }, [theme]);
  return null;
}
