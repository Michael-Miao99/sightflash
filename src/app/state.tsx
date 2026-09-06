import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState } from '../core/storage/types';
import type { SightRepo } from '../core/storage/memory';
import { MemoryRepo } from '../core/storage/memory';
import { IdbRepo, initialState } from './indexeddb';
import type { MixedClef } from '../core/generator/stages';

export type View = 'home' | 'setup' | 'practice' | 'result' | 'stats' | 'settings';

/** 测试缝：以 AppRoot/AppProvider 的 seed 覆盖初始 progress.stage 与 settings 部分字段。
 *  缺省 = initialState()，与产品行为完全一致；自动路径仍以 IndexedDB 首次载入为准。 */
export interface SeedState {
  stage?: number;
  lastClef?: MixedClef;
  /** 跟弹开关沿用偏好（settings.followPlay，§28 后老板追加）测试覆盖用 */
  followPlay?: boolean;
  /** 麦克风灵敏度（settings.micSens，老板可调）测试覆盖用 */
  micSens?: number;
}

export function seededState(seed?: SeedState): AppState {
  const def = initialState();
  if (!seed) return def;
  return {
    ...def,
    progress: { ...def.progress, stage: seed.stage ?? def.progress.stage },
    settings: {
      ...def.settings,
      lastClef: seed.lastClef ?? def.settings.lastClef,
      followPlay: seed.followPlay ?? def.settings.followPlay,
      micSens: seed.micSens ?? def.settings.micSens,
    },
  };
}

export interface AppStore {
  repo: SightRepo;
  state: AppState;
  view: View;
  go: (v: View) => void;
  setState: (updater: (prev: AppState) => AppState) => void;
  ready: boolean;
}

const Ctx = createContext<AppStore | null>(null);

export function useApp(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

/** repoKind 供测试注入内存实现；真实运行走 IndexedDB，不可用时内存兜底。init 供 memory/兜底仓储预置初始 state。 */
export function makeRepo(repoKind?: 'memory' | 'auto', init: AppState = initialState()): SightRepo {
  if (repoKind === 'memory') return new MemoryRepo(init);
  try {
    if (typeof indexedDB !== 'undefined') return new IdbRepo();
  } catch { /* ignore */ }
  return new MemoryRepo(init);
}

export function AppProvider({ repoKind, seed, children }: {
  repoKind?: 'memory' | 'auto';
  seed?: SeedState;
  children: ReactNode;
}) {
  const [repo, setRepo] = useState<SightRepo>(() => makeRepo(repoKind, seededState(seed)));
  const [state, setState] = useState<AppState>(() => seededState(seed));
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('home');

  // 首次载入
  useEffect(() => {
    let alive = true;
    repo
      .loadState()
      .then((s) => {
        if (!alive) return;
        setState(s);
        setReady(true);
      })
      .catch(() => {
        // IndexedDB 打开失败（隐私/存储禁用/配额）→ 内存降级，避免永久卡在载入
        if (!alive) return;
        setRepo(new MemoryRepo(initialState()));
        setReady(true);
      });
    return () => { alive = false; };
  }, [repo]);

  // 状态变更即持久化（本 App 数据量小，直接全量保存；ready 前不写以免覆盖载入）
  useEffect(() => {
    if (!ready) return;
    repo.saveState(state).catch((e) => console.warn('saveState failed', e));
  }, [repo, state, ready]);

  const store: AppStore = useMemo(
    () => ({ repo, state, view, go: setView, setState, ready }),
    [repo, state, view, ready],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
