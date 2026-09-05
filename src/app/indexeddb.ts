import { openDB, type DBSchema } from 'idb';
import type { AppState, SessionRecord } from '../core/storage/types';
import type { SightRepo } from '../core/storage/memory';
import { defaultState } from '../core/storage/logic';

interface SightDB extends DBSchema {
  kv: { key: string; value: AppState };
  sessions: { key: number; value: SessionRecord; autoIncrement: true };
}

let dbPromise: ReturnType<typeof openDB<SightDB>> | null = null;
function db() {
  if (!dbPromise) {
    dbPromise = openDB<SightDB>('sightflash', 1, {
      upgrade(d) {
        d.createObjectStore('kv');
        d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

export const KV_STATE = 'state';

/** 默认状态（统一走 core/storage/logic 的 defaultState） */
export { defaultState as initialState };

/** IndexedDB 仓储（真实运行环境） */
export class IdbRepo implements SightRepo {
  async loadState(): Promise<AppState> {
    const s = await (await db()).get('kv', KV_STATE);
    return s ?? defaultState();
  }
  async saveState(s: AppState): Promise<void> {
    await (await db()).put('kv', s, KV_STATE);
  }
  async addSession(s: SessionRecord): Promise<number> {
    return (await db()).add('sessions', s);
  }
  async listSessions(): Promise<SessionRecord[]> {
    return (await db()).getAll('sessions');
  }
  async clearAll(): Promise<void> {
    const d = await db();
    await d.clear('kv');
    await d.clear('sessions');
  }
}
