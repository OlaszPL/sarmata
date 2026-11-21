import { execFile } from 'node:child_process';
import { isAbsolute, posix, relative } from 'node:path';
import { type LegalFragment, type LegalSource, errorMessage } from '@sarmata/domain';
import { z } from 'zod';
import { type AiResult, failure } from './result';

/** Retrieval over the legal texts of a regulation version (the RAG of the procedure assistant). */
export interface LegalSearch {
  /** Fragments of the corpus files only, best first. */
  search(
    query: string,
    corpus: readonly LegalSource[],
    signal?: AbortSignal,
  ): Promise<AiResult<LegalFragment[]>>;
}

/** Where no search is configured. */
export const unavailableLegalSearch: LegalSearch = {
  search: () => Promise.resolve(failure('unavailable', 'Legal search is not configured')),
};

export interface SembleLegalSearchConfig {
  /** The semble executable and its leading arguments, e.g. `uvx --from semble[mcp]==0.6.1 semble`. */
  readonly command: readonly string[];
  /** Repository directory: corpus paths are relative to it. */
  readonly root: string;
  readonly topK?: number;
  readonly timeoutMs: number;
}

const sembleOutputSchema = z.object({
  results: z.array(
    z.object({
      file_path: z.string(),
      start_line: z.number().int(),
      end_line: z.number().int(),
      content: z.string(),
    }),
  ),
});

const headingOf = (content: string): string | null => {
  const line = content.split('\n').find((candidate) => candidate.trimStart().startsWith('#'));
  return line === undefined ? null : line.replace(/^\s*#+\s*/, '').trim() || null;
};

function run(
  command: readonly string[],
  args: readonly string[],
  options: { cwd: string; timeoutMs: number; signal?: AbortSignal },
): Promise<AiResult<string>> {
  const [file, ...leading] = command;
  if (file === undefined) return Promise.resolve(failure('unavailable', 'No semble command'));
  return new Promise((resolve) => {
    execFile(
      file,
      [...leading, ...args],
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        ...(options.signal ? { signal: options.signal } : {}),
      },
      (error, stdout) => {
        if (error === null) {
          resolve({ ok: true, value: stdout });
        } else if (error.killed && error.signal === 'SIGTERM' && error.code === null) {
          resolve(failure('timeout', `semble gave no answer within ${options.timeoutMs} ms`));
        } else {
          resolve(failure('unavailable', `semble failed: ${errorMessage(error)}`));
        }
      },
    );
  });
}

/**
 * semble CLI over the source directories of the corpus. semble takes directories only and reports
 * `file_path` relative to what it searched, so a result is matched back to a corpus file by its path
 * suffix, and files outside the corpus (another file in the same directory) are dropped.
 */
export function createSembleLegalSearch(config: SembleLegalSearchConfig): LegalSearch {
  const topK = config.topK ?? 5;
  return {
    async search(query, corpus, signal) {
      if (corpus.length === 0) return { ok: true, value: [] };
      const directories = [...new Set(corpus.map((source) => posix.dirname(source.path)))];
      const output = await run(
        config.command,
        [
          'search',
          query,
          ...directories,
          '--content',
          'docs',
          '--format',
          'json',
          '-k',
          String(topK * 3),
        ],
        { cwd: config.root, timeoutMs: config.timeoutMs, ...(signal ? { signal } : {}) },
      );
      if (!output.ok) return output;
      let json: unknown;
      try {
        json = JSON.parse(output.value);
      } catch {
        return failure('invalid_response', 'semble output is not JSON');
      }
      const parsed = sembleOutputSchema.safeParse(json);
      if (!parsed.success) return failure('invalid_response', z.prettifyError(parsed.error));
      const sourceOf = (filePath: string): LegalSource | undefined => {
        const path = (isAbsolute(filePath) ? relative(config.root, filePath) : filePath)
          .split('\\')
          .join('/');
        return corpus.find((source) => source.path === path || source.path.endsWith(`/${path}`));
      };
      const fragments: LegalFragment[] = [];
      for (const result of parsed.data.results) {
        if (fragments.length >= topK) break;
        const source = sourceOf(result.file_path);
        if (source === undefined) continue;
        fragments.push({
          id: fragments.length + 1,
          sourceId: source.sourceId,
          title: source.title,
          citation: source.citation,
          heading: headingOf(result.content),
          text: result.content,
          path: source.path,
          startLine: result.start_line,
          endLine: result.end_line,
        });
      }
      return { ok: true, value: fragments };
    },
  };
}
