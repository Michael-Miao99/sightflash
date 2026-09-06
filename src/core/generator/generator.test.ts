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

describe('stages chromatic 池（练黑键）', () => {
  it('chromatic 池 = 自然前缀 ∪ 池内自然音上邻黑键（钉死不变量）', () => {
    for (const clef of ['treble', 'bass'] as const) {
      for (let s = 1; s <= MAX_STAGE; s++) {
        const nat = poolForStage(s, clef);
        if (nat.length === 0) continue; // 空池（低音 S1 未解锁）chromatic 亦空，不变量真空
        const chrom = poolForStage(s, clef, 'chromatic');
        // 升序、去重
        expect(chrom).toEqual([...chrom].sort((a, b) => a - b));
        expect(new Set(chrom).size).toBe(chrom.length);
        // 上下界 = 自然池上下界（黑键不越界）
        expect(chrom[0]).toBe(Math.min(...nat));
        expect(chrom[chrom.length - 1]).toBe(Math.max(...nat));
        // 自然前缀完整保留
        for (const m of nat) expect(chrom).toContain(m);
        // 池内黑键唯一来自其下方自然音（C/D/F/G/A 上邻），E/B 之上不产生黑键
        for (const b of chrom) {
          if ([1, 3, 6, 8, 10].includes(b % 12)) {
            expect(nat).toContain(b - 1);
            expect([0, 2, 5, 7, 9]).toContain((b - 1) % 12);
          }
        }
      }
    }
  });

  it('S1 高音 chromatic 只扩 C#4/D#4；S3 高音凑满一个整八度 C4~B4', () => {
    expect(poolForStage(1, 'treble', 'chromatic')).toEqual([60, 61, 62, 63, 64]);
    expect(poolForStage(3, 'treble', 'chromatic')).toEqual(
      Array.from({ length: 12 }, (_, i) => 60 + i),
    );
  });
});

describe('generator 变化音出题', () => {
  it('chromatic 黑键题带 acc(#/b 之一)、自然题无 acc', () => {
    const rng = mulberry32(21);
    const chrom = poolForStage(5, 'treble', 'chromatic');
    const black = new Set(chrom.filter((m) => [1, 3, 6, 8, 10].includes(m % 12)));
    const accSeen = new Set<string>();
    let blackHit = 0;
    for (let i = 0; i < 800; i++) {
      const q = chooseQuestion(rng, 5, 'treble', {}, -1, 'chromatic');
      expect(chrom).toContain(q.midi);
      if (black.has(q.midi)) {
        blackHit++;
        expect(['#', 'b']).toContain(q.acc ?? '');
        accSeen.add(q.acc as string);
      } else {
        expect(q.acc).toBeUndefined();
      }
    }
    expect(blackHit).toBeGreaterThan(0);
    expect(accSeen.has('#')).toBe(true);
    expect(accSeen.has('b')).toBe(true);
  });

  it('缺省（natural）出题不含黑键、无 acc', () => {
    const rng = mulberry32(4);
    for (let i = 0; i < 60; i++) {
      const q = chooseQuestion(rng, 5, 'treble', {}, -1);
      expect([0, 2, 4, 5, 7, 9, 11]).toContain(q.midi % 12);
      expect(q.acc).toBeUndefined();
    }
  });
});
