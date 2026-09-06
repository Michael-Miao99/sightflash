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
import { CalibrateScreen } from '../ui/CalibrateScreen';

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
    case 'calibrate': return <CalibrateScreen />;
    case 'result': return <ResultScreen />;
    case 'stats': return <StatsScreen />;
    case 'settings': return <SettingsScreen />;
    case 'home':
    default: return <HomeScreen />;
  }
}

/** 主题同步：settings.theme（真源）→ <html data-theme> + localStorage 首帧镜像。
 *  ready 后即设一次（含老档缺字段回落的 paper），后续仅 theme 变化时重设。
 *  就绪前不写，避免 DB 载入期间把默认 paper 短暂刷到非默认主题用户身上（首帧底色由 main.tsx applyBootTheme 负责）。 */
function ThemeSync() {
  const { state, ready } = useApp();
  const theme = normalizeTheme(state.settings.theme);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    mirrorTheme(theme);
  }, [theme, ready]);
  return null;
}
