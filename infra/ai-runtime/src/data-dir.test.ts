import { describe, expect, it } from 'vitest';
import { defaultDataDir } from './index.ts';

describe('defaultDataDir', () => {
  it.each([
    ['macos', {}, '/Users/ala', '/Users/ala/Library/Application Support/sarmata/ai'],
    ['linux', {}, '/home/ala', '/home/ala/.local/share/sarmata/ai'],
    ['linux', { XDG_DATA_HOME: '/srv/data' }, '/home/ala', '/srv/data/sarmata/ai'],
    [
      'windows',
      { LOCALAPPDATA: 'C:\\Users\\Ala\\AppData\\Local' },
      'C:\\Users\\Ala',
      'C:\\Users\\Ala\\AppData\\Local\\sarmata\\ai',
    ],
  ] as const)('%s with %o', (os, env, home, expected) => {
    expect(defaultDataDir(os, env, home)).toBe(expected);
  });
});
