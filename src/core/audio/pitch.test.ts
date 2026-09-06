import { describe, expect, it } from 'vitest';
import {
  midiToHz, hzToMidi, roundToMidi, centsBetween,
  matches, deviationLabel, MATCH_TOL_CENTS,
} from './pitch';

describe('pitch 换算与比对纯函数（§27.3）', () => {
  it('midiToHz / hzToMidi 往返：A4=440→69、C4=60、G2=43、G5=79', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    for (const m of [60, 43, 79]) {
      expect(hzToMidi(midiToHz(m))).toBeCloseTo(m, 4);
    }
  });

  it('roundToMidi / centsBetween：半音域换算', () => {
    expect(roundToMidi(60.49)).toBe(60);
    expect(roundToMidi(60.5)).toBe(61);
    expect(centsBetween(62, 60)).toBe(200); // 1 半音 = 100¢
    expect(centsBetween(59.5, 60)).toBe(-50);
  });

  it('MATCH_TOL_CENTS=30 且 matches 为 ±30¢ 容差谓词', () => {
    expect(MATCH_TOL_CENTS).toBe(30);
    expect(matches(60, 60)).toBe(true);
    expect(matches(60.299, 60)).toBe(true);  // 29.9¢ 内
    expect(matches(60.31, 60)).toBe(false);  // 31¢ 外
    expect(matches(72, 60)).toBe(false);     // 高一个八度必不符（30¢≪半音⇒蕴含八度一致）
    expect(matches(60, 60, 40)).toBe(true);  // 自定义容差
  });

  it('deviationLabel：命中返回空串；各偏差分支措辞', () => {
    expect(deviationLabel(60, 60)).toBe('');
    expect(deviationLabel(60.2, 60)).toBe('');                        // 20¢ 内=命中
    expect(deviationLabel(60.4, 60)).toBe('你弹了 C4：偏高 40 音分');  // 30<¢<50 同键音不准
    expect(deviationLabel(64, 60)).toBe('你弹了 E4：偏高 4 个半音');   // 半音差（跨谱字但不足一全八度）
    expect(deviationLabel(55, 60)).toBe('你弹了 G3：偏低 5 个半音');   // 低 5 半音（即便越过八度编号界）
    expect(deviationLabel(72, 60)).toBe('你弹了 C5：比目标高一个八度'); // 同音名高八度
    expect(deviationLabel(48, 60)).toBe('你弹了 C3：比目标低一个八度'); // 同音名低八度
    expect(deviationLabel(84, 60)).toBe('你弹了 C6：比目标高 2 个八度');// 同音名跨两八度
    expect(deviationLabel(84, 62)).toBe('你弹了 C6：偏离音区（谱面 D4）'); // 跨音名且 ≥ 一整个八度
  });
});
