/**
 * 尝试把界面转成横屏：优先请求全屏（Chrome/Android 全屏会自动转横），再尝试
 * orientation.lock('landscape') 兜底锁定。返回是否发出了某种旋转请求；
 * iOS Safari 不支持根元素全屏也无 orientation.lock，会返回 false，由调用方提示手动旋转。
 */
export async function requestLandscape(): Promise<boolean> {
  let did = false;
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
      did = true;
    }
  } catch {
    /* 全屏被拒（如非手势/iframe 限制），继续尝试 orientation.lock */
  }
  try {
    const so = (screen as Screen & { orientation?: ScreenOrientation }).orientation;
    if (so && typeof so.lock === 'function') {
      await so.lock('landscape');
      did = true;
    }
  } catch {
    /* orientation 不可用/被拒（如 iOS）：以 did 为准，调用方决定是否提示手动旋转 */
  }
  return did;
}
