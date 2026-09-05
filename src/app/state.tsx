import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState } from '../core/storage/types';
import type { SightRepo } from '../core/storage/memory';
import { MemoryRepo } from '../core/storage/memory';
import { IdbRepo, initialState } from './indexeddb';

export type View = 'home' | 'setup' | 'practice' | 'result' | 'stats' | 'settings';

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

/** repoKind 供测试注入内存实现；真实运行走 IndexedDB，不可用时内存兜底 */
export function makeRepo(repoKind?: 'memory' | 'auto'): SightRepo {
  if (repoKind === 'memory') return new MemoryRepo(initialState());
  try {
    if (typeof indexedDB !== 'undefined') return new IdbRepo();
  } catch { /* ignore */ }
  return new MemoryRepo(initialState());
}

export function AppProvider({ repoKind, children }: { repoKind?: 'memory' | 'auto'; children: ReactNode }) {
  const [repo, setRepo] = useState<SightRepo>(() => makeRepo(repoKind));
  const [state, setState] = useState<AppState>(initialState());
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
