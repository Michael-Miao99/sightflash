import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../app/state';
import { defaultState } from '../core/storage/logic';
import { DEFAULT_MIC_SENS, MIC_SENS_MAX, MIC_SENS_MIN } from '../core/audio/onset';
import {
  midiGetDeviceName, midiGetStatus, midiIsSupported, midiRequest, midiStop, midiSubscribe,
} from './midiSource';
import type { MidiStatus } from './midiSource';
import { normalizeTheme, THEMES } from './themes';

/** 灵敏度三段语感标签（0..100） */
function sensTag(s: number): string {
  if (s <= 30) return '灵敏';
  if (s >= 70) return '稳健';
  return '适中';
}

export function SettingsScreen() {
  const { state, setState, repo, go } = useApp();
  // MIDI 键盘连接（§29）：模块级单例状态，进设置页即读；连接成功即开"跟弹优先 MIDI"偏好并持久化
  const [midiStatus, setMidiStatus] = useState<MidiStatus>(midiGetStatus);
  useEffect(() => midiSubscribe(() => setMidiStatus(midiGetStatus())), []);
  const midiSupported = midiIsSupported();
  async function onMidiConnect() {
    const s = await midiRequest();
    setMidiStatus(midiGetStatus());
    if (s === 'running' || s === 'requesting') {
      setState((p) => ({ ...p, settings: { ...p.settings, midiPrefer: true } }));
    }
  }
  function onMidiDisconnect() {
    midiStop();
    setMidiStatus(midiGetStatus());
    setState((p) => ({ ...p, settings: { ...p.settings, midiPrefer: false } })); // 显式断开 = 不再偏好
  }
  const connectBtn = <button className="sel small" data-testid="midi-connect" onClick={onMidiConnect}>连接 MIDI 键盘</button>;
  let midiLabel = '';
  let midiHint = '';
  let midiAction: ReactNode = null;
  if (!midiSupported) { midiLabel = '此浏览器不支持'; midiHint = 'iPhone Safari 不支持 MIDI，跟弹走麦克风'; }
  else if (midiStatus === 'running') {
    midiLabel = `已连接 · ${midiGetDeviceName()}`;
    midiHint = '跟弹将自动优先用它作答';
    midiAction = <button className="sel small" data-testid="midi-disconnect" onClick={onMidiDisconnect}>断开</button>;
  } else if (midiStatus === 'requesting') { midiLabel = '连接中…'; midiHint = '连接中，若停留请确认键盘已接上'; }
  else if (midiStatus === 'denied') { midiLabel = '连接被拒'; midiHint = '到浏览器/系统放行后重试'; midiAction = connectBtn; }
  else if (midiStatus === 'error') { midiLabel = '连接出错'; midiHint = '拔插键盘或换浏览器重试'; midiAction = connectBtn; }
  else { midiLabel = '未连接'; midiHint = '桌面 Chrome / Android Chrome 可连 MIDI 键盘（iPhone 不支持）'; midiAction = connectBtn; }
  return (
    <main className="screen settings">
      <h1>设置</h1>
      <div className="card">
        <div className="row"><span>声音</span>
          <button className="sel small" onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, sound: !p.settings.sound } }))}>
            {state.settings.sound ? '开' : '关'}
          </button>
        </div>
        <div className="row"><span>练黑键（变化音）</span>
          <button className="sel small" data-testid="gamut-toggle" onClick={() => setState((p) => ({
            ...p, settings: { ...p.settings, gamut: (p.settings.gamut ?? 'natural') === 'chromatic' ? 'natural' : 'chromatic' },
          }))}>
            {(state.settings.gamut ?? 'natural') === 'chromatic' ? '开' : '关'}
          </button>
        </div>
        <div className="row"><span>每轮时长</span>
          {[30, 60].map((d) => (
            <button key={d} className="sel small" onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, durationSec: d } }))}>
              {d}s{state.settings.durationSec === d ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <div className="mic-sens">
          <div className="row space-between">
            <span>麦克风灵敏度（跟弹）</span>
            <span className="sens-tag" data-testid="mic-sens-tag">
              {sensTag(state.settings.micSens ?? DEFAULT_MIC_SENS)} · {state.settings.micSens ?? DEFAULT_MIC_SENS}
            </span>
          </div>
          <input
            type="range" min={MIC_SENS_MIN} max={MIC_SENS_MAX} step={1}
            aria-label="麦克风灵敏度" data-testid="mic-sens"
            value={state.settings.micSens ?? DEFAULT_MIC_SENS}
            onChange={(e) => setState((p) => ({ ...p, settings: { ...p.settings, micSens: Number(e.target.value) } }))}
          />
          <div className="sens-scale"><span>灵敏</span><span>适中</span><span>稳健</span></div>
        </div>
        <div className="mic-sens">
          <div className="row space-between">
            <span>MIDI 键盘（跟弹优先）</span>
            <span className="sens-tag" data-testid="midi-state">{midiLabel}</span>
          </div>
          <div className="sens-scale"><span>{midiHint}</span>{midiAction}</div>
        </div>
        <div className="row"><span>主题</span>
          {THEMES.map((t) => (
            <button key={t.id} className="sel small" data-testid={`theme-${t.id}`}
              onClick={() => setState((p) => ({ ...p, settings: { ...p.settings, theme: t.id } }))}>
              {t.label}{normalizeTheme(state.settings.theme) === t.id ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <button className="danger" onClick={async () => {
          if (!window.confirm('确定清除全部本地数据？进度、连续天数与练习记录都会被清空。')) return;
          try {
            await repo.clearAll();
            setState(() => defaultState());
          } catch (e) {
            console.warn('clearAll failed', e);
          }
        }}>清除本地数据</button>
      </div>
      <button className="ghost" onClick={() => go('home')}>返回</button>
    </main>
  );
}
