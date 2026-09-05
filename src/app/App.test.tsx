import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppRoot } from './App';

describe('AppRoot', () => {
  it('加载后首页出现“五线速读”', async () => {
    render(<AppRoot repoKind="memory" />);
    expect(await screen.findByText(/五线速读/)).toBeInTheDocument();
  });
});
