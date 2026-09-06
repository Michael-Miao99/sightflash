import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaffView } from './StaffView';

describe('StaffView', () => {
  it('渲染 5 条线与谱号与音符头', () => {
    render(<StaffView midi={67} clef="treble" />); // G4 在第 2 线，无需加线
    expect(document.querySelectorAll('line.staff-line')).toHaveLength(5);
    expect(screen.getByTestId('clef')).toBeInTheDocument();
    expect(document.querySelector('ellipse.note-head')).not.toBeNull();
  });

  it('C4 在低音谱需要上加一线（出现 1 条加线）', () => {
    render(<StaffView midi={60} clef="bass" />);
    expect(document.querySelectorAll('line.ledger')).toHaveLength(1);
  });

  it('垂直方向正确：低音在下、高音在上（y 坐标单调）', () => {
    const low = render(<StaffView midi={60} clef="treble" />); // C4 在底线下方（下加一线）
    const high = render(<StaffView midi={77} clef="treble" />); // F5 顶线
    const y = (el: HTMLElement) =>
      Number(el.querySelector('ellipse.note-head')!.getAttribute('cy'));
    expect(y(low.container)).toBeGreaterThan(y(high.container));
  });
});

describe('StaffView 变化音记号', () => {
  it('acc="#" 黑键：渲染 ♯ 记号，且谱面锚在拼写字母（C#4 与 C4 同 cy）', () => {
    const { container } = render(<StaffView midi={61} clef="treble" acc="#" />);
    const accEl = container.querySelector('[data-testid="accidental"]');
    expect(accEl).not.toBeNull();
    expect(accEl!.textContent).toBe('♯');
    const cy = container.querySelector('.note-head')!.getAttribute('cy');
    const { container: c2 } = render(<StaffView midi={60} clef="treble" />);
    expect(cy).toBe(c2.querySelector('.note-head')!.getAttribute('cy')); // C#4 锚 C4 位置
  });

  it('acc="b" 黑键：锚在上方自然音（Db4 与 D4 同 cy）', () => {
    const { container } = render(<StaffView midi={61} clef="treble" acc="b" />);
    expect(container.querySelector('[data-testid="accidental"]')!.textContent).toBe('♭');
    const cy = container.querySelector('.note-head')!.getAttribute('cy');
    const { container: c2 } = render(<StaffView midi={62} clef="treble" />);
    expect(cy).toBe(c2.querySelector('.note-head')!.getAttribute('cy'));
  });

  it('自然音（无 acc）不渲染记号元素', () => {
    const { container } = render(<StaffView midi={60} clef="treble" />);
    expect(container.querySelector('[data-testid="accidental"]')).toBeNull();
  });
});
