import { describe, it, expect } from 'vitest';
import { mulberry32, pickWeighted, chooseMidi, chooseQuestion } from './generator';
import { poolForStage, MAX_STAGE, clefUnlockStage } from './stages';

describe('stages 难度阶梯', () => {
  it('阶段递增时高音池只增不减', () => {
    for (let s = 1; s < MAX_STAGE; s++) {
      expect(poolForStage(s + 1, 'treble').length).toBeGreaterThan(poolForStage(s, 'treble').length);
    }
  });

  it('低音 S2 解锁、混合 S3 解锁', () => {
    expect(clefUnlockStage('treble')).toBe(1);
    expect(clefUnlockStage('bass')).toBe(2);
    expect(clefUnlockStage('mixed')).toBe(3);
  });

  it('混合池 = 高音 + 低音并集', () => {
    const mixed = poolForStage(3, 'mixed');
    expect(mixed).toContain(64); // 高音(E4)
    expect(mixed).toContain(57); // 低音(A3)
  });

  it('全池只含自然音', () => {
    for (const clef of ['treble', 'bass'] as const) {
      for (let s = 1; s <= MAX_STAGE; s++) {
        for (const m of poolForStage(s, clef)) {
          expect([0, 2, 4, 5, 7, 9, 11]).toContain(m % 12);
        }
      }
    }
  });
});

describe('generator 出题', () => {
  it('mulberry32 固定种子产出确定序列', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBe(r2());
  });

  it('pickWeighted 依权重选中', () => {
    const rng = mulberry32(7);
    expect(pickWeighted(rng, ['a', 'b', 'c'], [1, 90, 1])).toBe('b');
  });

  it('chooseMidi 落在池内且相邻不重复（池>1）', () => {
    const rng = mulberry32(123);
    const pool = poolForStage(3, 'treble');
    let prev = pool[0];
    for (let i = 0; i < 50; i++) {
      const m = chooseMidi(rng, 3, 'treble', {}, prev);
      expect(pool).toContain(m);
      expect(m).not.toBe(prev);
      prev = m;
    }
  });

  it('chooseQuestion 返回 midi+clef，混合时两谱都会出现', () => {
    const rng = mulberry32(5);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const q = chooseQuestion(rng, 5, 'mixed', {}, -1);
      expect(poolForStage(5, q.clef)).toContain(q.midi);
      seen.add(q.clef);
    }
    expect(seen.has('treble')).toBe(true);
    expect(seen.has('bass')).toBe(true);
  });

  it('错音加权：错得多的音被抽中次数显著上升', () => {
    const pool = poolForStage(5, 'treble');
    const target = pool[0];
    const rng = mulberry32(9);
    let hit = 0;
    for (let i = 0; i < 2000; i++) {
      if (chooseMidi(rng, 5, 'treble', { [target]: 5 }, -1) === target) hit++;
    }
    expect(hit).toBeGreaterThan(400); // 加权 1+min(5,3)=4/15 ≈ 27%，2000 次约 530
    expect(hit).toBeLessThan(900);
  });
});
