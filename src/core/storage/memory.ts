import type { AppState, SessionRecord } from './types';

/** 仓储接口：里程碑 B（云同步/降级）复用同一接口 */
export interface SightRepo {
  loadState(): Promise<AppState>;
  saveState(s: AppState): Promise<void>;
  addSession(s: SessionRecord): Promise<number>;
  listSessions(): Promise<SessionRecord[]>;
  clearAll(): Promise<void>;
}

/** 内存实现：供测试与浏览器无 IndexedDB 时降级 */
export class MemoryRepo implements SightRepo {
  private state: AppState;
  private sessions: SessionRecord[] = [];
  private seq = 1;

  constructor(initial: AppState) {
    this.state = structuredClone(initial);
  }

  async loadState(): Promise<AppState> {
    return structuredClone(this.state);
  }
  async saveState(s: AppState): Promise<void> {
    this.state = structuredClone(s);
  }
  async addSession(s: SessionRecord): Promise<number> {
    const rec = { ...structuredClone(s), id: this.seq++ };
    this.sessions.push(rec);
    return rec.id as number;
  }
  async listSessions(): Promise<SessionRecord[]> {
    return this.sessions.map((s) => structuredClone(s));
  }
  async clearAll(): Promise<void> {
    this.sessions = [];
  }
}
