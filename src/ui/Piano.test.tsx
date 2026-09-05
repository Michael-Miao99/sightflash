import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Piano } from './Piano.tsx';

afterEach(() => {
  cleanup();
});

describe('Piano', () => {
  it('高音窗口 C3~C6：22 白键 + 15 黑键，边界 C3/C6', () => {
    const onKey = vi.fn();
    render(<Piano clef="treble" onKey={onKey} />);
    expect(screen.getAllByTestId(/^w-/)).toHaveLength(22);
    expect(screen.getAllByTestId(/^b-/)).toHaveLength(15);
    expect(screen.getByTestId('w-48')).toBeInTheDocument(); // C3
    expect(screen.getByTestId('w-84')).toBeInTheDocument(); // C6
    expect(screen.getByTestId('b-61')).toBeInTheDocument(); // C#4
  });

  it('低音窗口 C2~C5：22 白键 + 15 黑键，边界 C2/C5', () => {
    const onKey = vi.fn();
    render(<Piano clef="bass" onKey={onKey} />);
    expect(screen.getAllByTestId(/^w-/)).toHaveLength(22);
    expect(screen.getAllByTestId(/^b-/)).toHaveLength(15);
    expect(screen.getByTestId('w-36')).toBeInTheDocument(); // C2
    expect(screen.getByTestId('w-72')).toBeInTheDocument(); // C5
    expect(screen.getByTestId('b-66')).toBeInTheDocument(); // F#4
  });

  it('仅中央C(C4=60) 白键带一个 c4 圆点（高音/低音窗口都有）', () => {
    const onKey = vi.fn();
    const first = render(<Piano clef="treble" onKey={onKey} />);
    expect(screen.queryAllByTestId('c4-marker')).toHaveLength(1);
    expect(within(screen.getByTestId('w-60')).getByTestId('c4-marker')).toBeInTheDocument();
    first.unmount();
    render(<Piano clef="bass" onKey={onKey} />);
    expect(screen.queryAllByTestId('c4-marker')).toHaveLength(1);
    expect(within(screen.getByTestId('w-60')).getByTestId('c4-marker')).toBeInTheDocument();
  });

  it('按下琴键触发 onKey(对应 midi)', () => {
    const onKey = vi.fn();
    render(<Piano clef="treble" onKey={onKey} />);
    fireEvent.pointerDown(screen.getByTestId('w-62')); // D4
    expect(onKey).toHaveBeenCalledWith(62);
    fireEvent.pointerDown(screen.getByTestId('b-63')); // D#4
    expect(onKey).toHaveBeenCalledWith(63);
  });
});
