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
});
