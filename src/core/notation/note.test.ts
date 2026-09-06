import { describe, it, expect } from 'vitest';
import { midiToName, nameToMidi, letterIndex, LETTER_PC, letterMidiOf, spelledName } from './note';

describe('note 音高模型', () => {
  it('midiToName: C4=60, A4=69, G2=43', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(43)).toBe('G2');
  });

  it('nameToMidi 与 midiToName 互逆', () => {
    expect(nameToMidi('C4')).toBe(60);
    expect(nameToMidi('A4')).toBe(69);
    expect(nameToMidi('G2')).toBe(43);
    expect(nameToMidi('B4')).toBe(71);
    expect(nameToMidi('bad')).toBeNull();
  });

  it('letterIndex: C=0, E=2, G=4, B=6', () => {
    expect(letterIndex('C')).toBe(0);
    expect(letterIndex('E')).toBe(2);
    expect(letterIndex('G')).toBe(4);
    expect(letterIndex('B')).toBe(6);
  });

  it('LETTER_PC: 按钮字母 → 音级半音', () => {
    expect(LETTER_PC['C']).toBe(0);
    expect(LETTER_PC['D']).toBe(2);
    expect(LETTER_PC['E']).toBe(4);
    expect(LETTER_PC['F']).toBe(5);
    expect(LETTER_PC['G']).toBe(7);
    expect(LETTER_PC['A']).toBe(9);
    expect(LETTER_PC['B']).toBe(11);
  });
});

describe('note 变化音拼写（黑键双记法）', () => {
  it('letterMidiOf：黑键 # 取下自然音、b 取上自然音、无记号原样', () => {
    expect(letterMidiOf(61, '#')).toBe(60); // C#4 → 拼写字母 C4
    expect(letterMidiOf(61, 'b')).toBe(62); // Db4 → 拼写字母 D4
    expect(letterMidiOf(78, '#')).toBe(77); // F#5 → F5
    expect(letterMidiOf(78, 'b')).toBe(79); // Gb5 → G5
    expect(letterMidiOf(61, null)).toBe(61);
    expect(letterMidiOf(60, undefined)).toBe(60);
  });

  it('spelledName：升降与自然', () => {
    expect(spelledName(61, '#')).toBe('C#4');
    expect(spelledName(61, 'b')).toBe('Db4');
    expect(spelledName(63, 'b')).toBe('Eb4');
    expect(spelledName(63, '#')).toBe('D#4');
    expect(spelledName(73, 'b')).toBe('Db5');
    expect(spelledName(60, null)).toBe('C4');
    expect(spelledName(60, undefined)).toBe('C4');
  });

  it('spelledName 对自然音与 midiToName 一致', () => {
    for (const m of [60, 62, 71, 79, 43]) expect(spelledName(m, null)).toBe(midiToName(m));
  });
});
