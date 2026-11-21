import { describe, expect, it } from 'vitest';
import { parsePartialJson } from './partial-json';

describe('parsePartialJson', () => {
  it('reads complete JSON as JSON.parse does', () => {
    const text = '{"a":[1,2.5,{"b":"x\\"y"}],"c":null,"d":true}';
    expect(parsePartialJson(text)).toEqual(JSON.parse(text));
  });

  it('keeps finished array elements and drops the one being written', () => {
    expect(parsePartialJson('{"sentences":[{"text":"Raz.","noteIds":["N1"]},{"text":"Dw')).toEqual({
      sentences: [{ text: 'Raz.', noteIds: ['N1'] }],
    });
  });

  it('leaves out unfinished strings, numbers and literals', () => {
    expect(parsePartialJson('{"goal":"Omówie')).toEqual({});
    expect(parsePartialJson('{"points":1')).toEqual({});
    expect(parsePartialJson('{"points":1,')).toEqual({ points: 1 });
    expect(parsePartialJson('{"ok":tr')).toEqual({});
  });

  it('keeps an unfinished nested list with its finished part', () => {
    expect(parsePartialJson('{"goal":"Cel.","plan":["Krok 1","Kro')).toEqual({
      goal: 'Cel.',
      plan: ['Krok 1'],
    });
  });

  it('handles an escape cut in the middle', () => {
    expect(parsePartialJson('{"a":"x","b":"y\\')).toEqual({ a: 'x' });
  });

  it('gives undefined for nothing or for text that is not JSON', () => {
    expect(parsePartialJson('')).toBeUndefined();
    expect(parsePartialJson('Oto szkic')).toBeUndefined();
  });
});
