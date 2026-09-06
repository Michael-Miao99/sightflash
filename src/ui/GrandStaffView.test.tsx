import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GrandStaffView } from './GrandStaffView';

const cyOf = (el: Element | null | undefined, sel: string) =>
  Number(el!.querySelector(sel)!.getAttribute('cy'));

describe('GrandStaffView', () => {
  it('渲染双行五线 + 双谱号 + 大括号 + 音符头', () => {
    const { container } = render(<GrandStaffView midi={67} clef="treble" />); // G4 高音第 2 线
    expect(container.querySelector('[data-testid="grand-staff"]')).not.toBeNull();
    expect(container.querySelectorAll('line.staff-line')).toHaveLength(10); // 两行 × 5 线
    expect(container.querySelector('[data-testid="clef-treble"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="clef-bass"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="brace"]')).not.toBeNull();
    expect(container.querySelector('ellipse.note-head')).not.toBeNull();
  });

  it('双行五线低行在下：全部线按 y1 升序后，上 5 条（高音行）max < 下 5 条（低音行）min', () => {
    const { container } = render(<GrandStaffView midi={60} clef="bass" />);
    const y1s = [...container.querySelectorAll('line.staff-line')]
      .map((l) => Number(l.getAttribute('y1')))
      .sort((a, b) => a - b);
    expect(y1s).toHaveLength(10);
    const upper = y1s.slice(0, 5); // 高音行（y 小 = 靠上）
    const lower = y1s.slice(5); // 低音行（y 大 = 靠下）
    expect(Math.max(...upper)).toBeLessThan(Math.min(...lower));
  });

  it('中央 C(C4) 在低音谱与高音谱的符头同高（共享间隙同一加线高度）', () => {
    const low = render(<GrandStaffView midi={60} clef="bass" />); // C4 低音上加一线
    const high = render(<GrandStaffView midi={60} clef="treble" />); // C4 高音下加一线
    expect(cyOf(low.container, 'ellipse.note-head')).toBe(cyOf(high.container, 'ellipse.note-head'));
    expect(low.container.querySelectorAll('line.ledger')).toHaveLength(1);
    expect(high.container.querySelectorAll('line.ledger')).toHaveLength(1);
  });

  it('低音题符头落在低音行、高音题符头落在高音行（高音题更高）', () => {
    const lowBass = render(<GrandStaffView midi={43} clef="bass" />); // G2 低音底线
    const highTreble = render(<GrandStaffView midi={79} clef="treble" />); // G5 高音顶线上方
    expect(cyOf(lowBass.container, 'ellipse.note-head')).toBeGreaterThan(cyOf(highTreble.container, 'ellipse.note-head'));
  });

  it('acc 记号仍画对（C#4 锚 C4 位置，谱面 ♯）', () => {
    const withAcc = render(<GrandStaffView midi={61} clef="treble" acc="#" />);
    expect(withAcc.container.querySelector('[data-testid="accidental"]')!.textContent).toBe('♯');
    const plain = render(<GrandStaffView midi={60} clef="treble" />);
    expect(cyOf(withAcc.container, 'ellipse.note-head')).toBe(cyOf(plain.container, 'ellipse.note-head'));
  });

  it('自然音不渲染记号元素', () => {
    const { container } = render(<GrandStaffView midi={60} clef="bass" />);
    expect(container.querySelector('[data-testid="accidental"]')).toBeNull();
  });
});
