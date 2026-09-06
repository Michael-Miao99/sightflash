// 校准页（§27.4）：play 前必经。首屏请求麦克风（用户手势内 getUserMedia/resume）；
// 授权后实时听音（音量条 + 当前音名），弹任意音验证（低音 G2 重点）；「开始练习」才进 practice 起倒计时。
// 隐私：只实时判音、不录制不上传。离开回 setup → stop() 释放流。
import { useApp } from '../app/state';
import { useMicPitch } from './useMicPitch';
import { midiToName } from '../core/notation/note';
import { roundToMidi } from '../core/audio/pitch';

export function CalibrateScreen() {
  const { state, go } = useApp();
  const { status, level, liveMidi, request, stop } = useMicPitch({ onOnset: () => {} });
  const clef = state.settings.lastClef;
  const clefName = clef === 'treble' ? '高音谱' : clef === 'bass' ? '低音谱' : '大谱表';
  const duration = state.settings.durationSec;

  const live = liveMidi === null ? '-' : midiToName(roundToMidi(liveMidi));

  return (
    <main className="screen calibrate">
      <h1>麦克风校准</h1>
      <div className="card">
        <div className="label">跟弹 · {clefName}</div>
        <p className="small">只实时听音判对错：不录制、不上传、不留存。授权后弹几个音验证识别（低音 G2 一带重点听，确认不锁高一八度）。</p>

        {status === 'idle' && (
          <button className="big primary" onClick={() => void request()}>请求麦克风</button>
        )}
        {status === 'requesting' && <div className="small">正在请求麦克风…</div>}
        {(status === 'denied' || status === 'error') && (
          <div className="small mic-error" data-testid="mic-error">
            麦克风不可用（{status === 'denied' ? '未授权' : '出错'}）。请在浏览器地址栏允许麦克风后重试，
            或返回换认音模式。
          </div>
        )}
        {status === 'unsupported' && (
          <div className="small mic-error" data-testid="mic-error">
            当前浏览器不支持麦克风判定，请改用认音模式。
          </div>
        )}
        {status === 'running' && (
          <>
            <div className="cal-live" data-testid="cal-live">
              现在听到：{live}{live !== '-' ? ' ✓' : ''}
            </div>
            <div className="mic-level"><div className="bar-fill" style={{ width: `${Math.round(level * 100)}%` }} /></div>
            <button className="big primary" onClick={() => go('practice')}>
              开始 {duration}s 练习
            </button>
          </>
        )}
      </div>
      <button className="ghost" onClick={() => { stop(); go('setup'); }}>返回</button>
    </main>
  );
}
