import { describe, expect, it } from 'vitest';
import { defaultState } from '../core/storage/logic';
import { DEFAULT_THEME } from '../core/storage/types';
import { normalizeTheme, THEMES } from './themes';

describe('主题数据层', () => {
  it('默认状态 theme = paper', () => {
    expect(defaultState().settings.theme).toBe('paper');
    expect(DEFAULT_THEME).toBe('paper');
  });

  it('THEMES 含四套且 paper 为首', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['paper', 'ebony', 'ink', 'classic']);
    expect(new Set(THEMES.map((t) => t.label)).size).toBe(4); // 名不重复
  });

  it('normalizeTheme：合法原样、非法/缺省回落 paper', () => {
    expect(normalizeTheme('ebony')).toBe('ebony');
    expect(normalizeTheme('classic')).toBe('classic');
    expect(normalizeTheme(undefined)).toBe('paper');
    expect(normalizeTheme('neon')).toBe('paper');
    expect(normalizeTheme(null)).toBe('paper');
    expect(normalizeTheme(42)).toBe('paper');
  });
});
