// YIN 基频估计（de Cheveigné & Kawahara 2002）。纯 TS、无浏览器依赖。
// 差函数 → 累积均值归一化差分(CMND) → 首过阈周期 → 抛物线插值细化。
// fftSize 窗长按 44.1k/48k 取样可容：2048 帧@48k≈43ms，最低出题音 G2≈98Hz 窗内 ≥4 周期。

export const YIN_THRESHOLD = 0.12; // CMND 过阈判定有周期

/**
 * 从一段时域样本估计基频。返回 Hz；无稳定基频（静音/噪声/过短窗/非法取样率）返回 null。
 * buf 长度建议 ≥ sampleRate/40（约 1024~2048 帧）。
 */
export function yinPitch(
  buf: Float32Array,
  sampleRate: number,
  threshold: number = YIN_THRESHOLD,
): number | null {
  const n = buf.length;
  if (n < 8 || sampleRate <= 0) return null;
  const half = n >> 1; // τ 最大取 n/2，保证差函数区间完整

  // 1. 差函数 d(τ)
  const d = new Float32Array(half);
  for (let tau = 0; tau < half; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // 2. CMND：d'(τ)=τ·d(τ)/Σ_{j=1..τ}d(j)，d'(0)=1（0 累积→保持 1，防 NaN）
  const cmnd = new Float32Array(half);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau < half; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }

  // 3. 第一个低于阈值的周期候选（τ 自 2 起，跳过 τ=1 的恒 1 与可能伪谷）
  let tauMin = -1;
  for (let tau = 2; tau < half; tau++) {
    if (cmnd[tau] < threshold) {
      tauMin = tau;
      break;
    }
  }
  if (tauMin <= 1 || tauMin >= half - 1) return null;

  // 3b. 自首过点沿下降沿走到 CMND 局部谷底：首过点常在 12% 阈的陡肩上，
  //     谷底才对应真实周期（τ≈T 处 d 近 0 的深谷），在其上插值才不偏（标准 YIN 细化）。
  let m = tauMin;
  while (m + 1 < half && cmnd[m + 1] < cmnd[m]) m++;
  if (m < 1 || m >= half - 1) m = tauMin; // 走不到谷底则退回首过点
  if (m < 1 || m >= half - 1) return null;

  // 4. 抛物线插值细化（用谷底 m 的 τ±1 邻点拟合亚采样周期）
  const a = cmnd[m - 1];
  const b = cmnd[m];
  const c = cmnd[m + 1];
  const denom = a - 2 * b + c;
  const betterTau = denom !== 0 ? m + (0.5 * (a - c)) / denom : m;
  const f0 = sampleRate / Math.max(1, betterTau);

  // 5. 合理性守卫：人耳可闻且窗可容纳
  return f0 > 20 && f0 < 20000 ? f0 : null;
}
