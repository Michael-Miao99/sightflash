import { DEFAULT_THEME, THEME_IDS } from '../core/storage/types';
import type { ThemeId } from '../core/storage/types';

/** localStorage 首帧镜像键：非真源，真源 = settings(IndexedDB)。仅避免首帧底色闪变。 */
export const LS_THEME = 'sf:theme';

export interface ThemeOption { id: ThemeId; label: string; }

/** 主题顺序即设置页展示顺序；首项 = 默认（暖纸乐稿）。 */
export const THEMES: ThemeOption[] = [
  { id: 'paper', label: '暖纸乐稿' },
  { id: 'ebony', label: '乌木暖夜' },
  { id: 'ink', label: '极简墨白' },
  { id: 'classic', label: '经典深色' },
];

/** 主题 id 判定（非串 / 非法值 → false） */
function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);
}

/** 任意值 → 合法主题；非法/空 → DEFAULT_THEME('paper')。老存档缺 theme 字段走这里回落。 */
export function normalizeTheme(v: unknown): ThemeId {
  return isThemeId(v) ? v : DEFAULT_THEME;
}

/** main.tsx render 前调用：读 localStorage 镜像设 <html data-theme>，保证首帧即正确底色。返回实际主题。 */
export function applyBootTheme(): ThemeId {
  let t: ThemeId = DEFAULT_THEME;
  try {
    const s = localStorage.getItem(LS_THEME);
    if (s) t = normalizeTheme(s);
  } catch { /* 隐私/禁用时忽略，用默认 */ }
  document.documentElement.dataset.theme = t;
  return t;
}

/** 主题变化后写镜像（只在实际不同时写，减少噪声）。 */
export function mirrorTheme(t: ThemeId): void {
  try {
    if (localStorage.getItem(LS_THEME) !== t) localStorage.setItem(LS_THEME, t);
  } catch { /* 隐私/禁用时忽略 */ }
}
