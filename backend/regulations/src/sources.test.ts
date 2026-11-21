import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

// Paths in `sources[].text` are relative to the repository root.
const repoRoot = new URL('../../../', import.meta.url);
const readSource = (path: string): string => readFileSync(new URL(path, repoRoot), 'utf8');

const sources = officialRegulations.flatMap((version) =>
  version.sources.map((source) => ({ version: version.id, ...source })),
);

describe('legal sources of the regulation versions', () => {
  it.each(sources)(
    'every source text file exists in the version directory ($version, $id)',
    (source) => {
      expect(source.text.startsWith(`backend/regulations/${source.version}/sources/`)).toBe(true);
      expect(readSource(source.text).trim().length).toBeGreaterThan(1000);
    },
  );

  it('source file names are unique', () => {
    const paths = sources.map((source) => source.text);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('no source points outside the version directory', () => {
    for (const source of sources) {
      const relative = source.text.slice(`backend/regulations/${source.version}/sources/`.length);
      expect(relative).not.toContain('/');
      expect(relative).not.toContain('..');
      expect(source.text.startsWith(`backend/regulations/${source.version}/sources/`)).toBe(true);
    }
  });
});
