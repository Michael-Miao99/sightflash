import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Piano } from './Piano.tsx';

afterEach(() => {
  cleanup();
});

describe('Piano', () => {
  it('固定窗口 C2~C6（4 个整八度）：29 白键 + 20 黑键，边界 C2/C6、首黑 C#2', () => {
    const onKey = vi.fn();
    render(<Piano onKey={onKey} />);
    expect(screen.getAllByTestId(/^w-/)).toHaveLength(29);
    expect(screen.getAllByTestId(/^b-/)).toHaveLength(20);
    expect(screen.getByTestId('w-36')).toBeInTheDocument(); // C2
    expect(screen.getByTestId('w-84')).toBeInTheDocument(); // C6
    expect(screen.getByTestId('b-37')).toBeInTheDocument(); // C#2
  });

  it('中央C(C4=60) 白键带唯一文字标注 "C4"，其余 C 键无标注', () => {
    const onKey = vi.fn();
    render(<Piano onKey={onKey} />);
    expect(screen.queryAllByTestId('c4-marker')).toHaveLength(1);
    const marker = within(screen.getByTestId('w-60')).getByTestId('c4-marker');
    expect(marker.textContent).toBe('C4');
    for (const m of [36, 48, 72, 84]) {
      expect(within(screen.getByTestId(`w-${m}`)).queryByTestId('c4-marker')).toBeNull();
    }
  });

  it('按下琴键触发 onKey(对应 midi)', () => {
    const onKey = vi.fn();
    render(<Piano onKey={onKey} />);
    fireEvent.pointerDown(screen.getByTestId('w-62')); // D4
    expect(onKey).toHaveBeenCalledWith(62);
    fireEvent.pointerDown(screen.getByTestId('b-63')); // D#4
    expect(onKey).toHaveBeenCalledWith(63);
  });
});

describe('Piano readOnly / highlight（§27.5 [键位提示]）', () => {
  it('readOnly 时不响应按键，容器带 .readonly', () => {
    const onKey = vi.fn();
    const { container } = render(<Piano onKey={onKey} readOnly />);
    fireEvent.pointerDown(screen.getByTestId('w-60'));
    fireEvent.pointerDown(screen.getByTestId('b-61'));
    expect(onKey).not.toHaveBeenCalled();
    expect(container.querySelector('.piano')?.classList.contains('readonly')).toBe(true);
  });

  it('highlight 给目标键加 .hl（白/黑皆可），其余键不加', () => {
    const onKey = vi.fn();
    const { rerender } = render(<Piano onKey={onKey} highlight={62} />);
    expect(screen.getByTestId('w-62').classList.contains('hl')).toBe(true);
    expect(screen.getByTestId('w-60').classList.contains('hl')).toBe(false);
    rerender(<Piano onKey={onKey} highlight={61} />);
    expect(screen.getByTestId('b-61').classList.contains('hl')).toBe(true);
    expect(screen.getByTestId('w-62').classList.contains('hl')).toBe(false);
  });

  it('默认（不传）行为与旧版一致：可点、无 .readonly/.hl', () => {
    const onKey = vi.fn();
    const { container } = render(<Piano onKey={onKey} />);
    fireEvent.pointerDown(screen.getByTestId('w-62'));
    expect(onKey).toHaveBeenCalledWith(62);
    expect(container.querySelector('.piano')?.classList.contains('readonly')).toBe(false);
    expect(screen.queryByText('', { selector: '.hl' })).toBeNull();
  });
});
