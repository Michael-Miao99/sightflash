import { describe, it, expect } from 'vitest';
import { MemoryRepo } from './memory';
import { defaultState } from './logic';

describe('MemoryRepo', () => {
  it('保存后能读回', async () => {
    const repo = new MemoryRepo(defaultState());
    const s = await repo.loadState();
    s.progress.stage = 3;
    await repo.saveState(s);
    expect((await repo.loadState()).progress.stage).toBe(3);
  });

  it('addSession 返回自增 id 且可列举', async () => {
    const repo = new MemoryRepo(defaultState());
    const id = await repo.addSession({
      ts: 1, mode: 'tap', clef: 'treble', stage: 1,
      correct: 10, total: 12, durationSec: 60, speed: 10, accuracy: 83,
    });
    expect(id).toBe(1);
    expect((await repo.listSessions()).length).toBe(1);
  });
});
