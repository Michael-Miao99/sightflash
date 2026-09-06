// 把 micSource 单例接进 React（§27.3）。Calibrate 与 Practice 各挂一套 handlers；
// 卸载只清 handlers 不断流（校准→练习沿用）；request/stop 显式透传。
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  micGetStatus, micRequest, micSetHandlers, micStop, micSubscribe,
} from './micSource';
import type { MicStatus } from './micSource';
import type { OnsetEvent } from '../core/audio/onset';

export interface MicPitch {
  status: MicStatus;
  /** 音量条 0..1（实时，~10Hz 节流由 micSource 每 3 帧触发一次保证） */
  level: number;
  /** 当前识别音高（浮点 MIDI，可含音分偏差）；无声/未识别 null */
  liveMidi: number | null;
  /** 用户手势内调用：请求授权并开流（已 running 幂等） */
  request(): Promise<void>;
  /** 释放媒体流并复位（到点结算 / 离开校准页回 setup） */
  stop(): void;
}

export function useMicPitch(opts: { onOnset: (e: OnsetEvent) => void }): MicPitch {
  const [status, setStatusState] = useState<MicStatus>(micGetStatus);
  const [level, setLevel] = useState(0);
  const [liveMidi, setLiveMidi] = useState<number | null>(null);
  const onsetRef = useRef(opts.onOnset);
  onsetRef.current = opts.onOnset;

  // 订阅模块状态（授权失败 / 流中断 / 他处 stop 都会推到这里）
  useEffect(() => micSubscribe(() => setStatusState(micGetStatus())), []);

  // 挂本屏 handlers；卸载仅清理（不断流）；若挂载时已 running（校准沿用）会由 micSetHandlers 重启 rAF
  useEffect(() => {
    micSetHandlers({
      onOnset: (e) => onsetRef.current(e),
      onLevel: (l, m) => {
        setLevel(l);
        setLiveMidi(m);
      },
    });
    return () => {
      micSetHandlers(null);
      setLevel(0);
      setLiveMidi(null);
    };
  }, []);

  const request = useCallback(async () => {
    await micRequest();
    setStatusState(micGetStatus());
  }, []);
  const stop = useCallback(() => {
    micStop();
    setStatusState(micGetStatus());
  }, []);

  return { status, level, liveMidi, request, stop };
}
