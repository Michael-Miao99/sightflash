import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
// 显式 .tsx 扩展：同目录已有 committed 的 WebAudio 引擎 piano.ts（仅大小写不同）。
// Windows 大小写不敏感文件系统上，Vite 按扩展顺序 .ts 先于 .tsx 解析，裸 "./Piano" 会误解析到 piano.ts。
import { Piano } from './Piano.tsx';

afterEach(() => {
  cleanup();
});

describe('Piano', () => {
  it('高音窗口 C4~C6：15 白键 + 10 黑键，首尾键号正确', () => {
    const onKey = vi.fn();
    render(<Piano clef="treble" onKey={onKey} />);
    expect(screen.getAllByTestId(/^w-/)).toHaveLength(15);
    expect(screen.getAllByTestId(/^b-/)).toHaveLength(10);
    expect(screen.getByTestId('w-60')).toBeInTheDocument(); // C4
    expect(screen.getByTestId('w-84')).toBeInTheDocument(); // C6
    expect(screen.getByTestId('b-61')).toBeInTheDocument(); // C#4
  });

  it('低音窗口 G2~G4：15 白键 + 10 黑键，边界 G2/G4', () => {
    const onKey = vi.fn();
    render(<Piano clef="bass" onKey={onKey} />);
    expect(screen.getByTestId('w-43')).toBeInTheDocument(); // G2
    expect(screen.getByTestId('w-67')).toBeInTheDocument(); // G4
    expect(screen.getByTestId('b-66')).toBeInTheDocument(); // F#4
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
