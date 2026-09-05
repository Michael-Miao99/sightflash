import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestLandscape } from './landscape';

/** 给 screen.orientation.lock 打桩；无参数则视为无 orientation。 */
function stubScreenOrientation(lock?: () => Promise<void>): void {
  const orientation = lock ? { lock } : undefined;
  vi.stubGlobal('screen', { orientation });
}

function stubFullscreen(fn?: () => Promise<void>): void {
  // 用 defineProperty 覆盖（含覆盖为 undefined 以“清除”桩），避免 delete 必选方法成员的类型限制。
  const html = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
  Object.defineProperty(html, 'requestFullscreen', {
    value: fn ? vi.fn(fn) : undefined,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  stubFullscreen(); // 清掉 requestFullscreen 桩
});

describe('requestLandscape', () => {
  it('有 orientation.lock 且成功 → true（无需全屏）', async () => {
    const lock = vi.fn(async () => undefined);
    stubScreenOrientation(lock);
    await expect(requestLandscape()).resolves.toBe(true);
    expect(lock).toHaveBeenCalledWith('landscape');
  });

  it('无 orientation.lock、有 requestFullscreen → 请求全屏并返回 true', async () => {
    stubScreenOrientation();
    const fs = vi.fn(async () => undefined);
    stubFullscreen(fs);
    await expect(requestLandscape()).resolves.toBe(true);
    expect(fs).toHaveBeenCalledTimes(1);
  });

  it('orientation.lock 抛错时回退到 requestFullscreen', async () => {
    stubScreenOrientation(async () => {
      throw new Error('lock needs fullscreen');
    });
    const fs = vi.fn(async () => undefined);
    stubFullscreen(fs);
    await expect(requestLandscape()).resolves.toBe(true);
    expect(fs).toHaveBeenCalledTimes(1);
  });

  it('两者都不可用 → false 且不抛（iOS Safari 场景）', async () => {
    stubScreenOrientation();
    stubFullscreen();
    await expect(requestLandscape()).resolves.toBe(false);
  });
});
