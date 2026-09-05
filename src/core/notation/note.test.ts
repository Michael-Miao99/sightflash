import { describe, it, expect } from 'vitest';
import { midiToPc, midiToName, nameToMidi, letterIndex, LETTER_PC } from './note';

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
