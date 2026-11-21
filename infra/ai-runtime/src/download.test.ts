import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DownloadAsset, ProgressEvent } from './context.ts';
import { downloadVerified, lockFile } from './download.ts';
import { listen } from './test-helpers.ts';

const CONTENT = Buffer.from('Bielik '.repeat(4096));
const SHA256 = createHash('sha256').update(CONTENT).digest('hex');
// A process id no system hands out: kill(pid, 0) fails with ESRCH.
const DEAD_PID = 2_147_483_646;

interface Fixture {
  asset: DownloadAsset;
  requests: { range: string | undefined }[];
  close: () => Promise<void>;
}

/** A file server on a random port. `ranges: false` ignores Range like some proxies do. */
async function serve(options: { ranges?: boolean; body?: Buffer } = {}): Promise<Fixture> {
  const body = options.body ?? CONTENT;
  const requests: Fixture['requests'] = [];
  const handler = (request: IncomingMessage, response: ServerResponse): void => {
    const range = request.headers.range;
    requests.push({ range });
    const match = /^bytes=(\d+)-$/.exec(range ?? '');
    if (match && options.ranges !== false) {
      const start = Number(match[1]);
      response.writeHead(206, {
        'content-range': `bytes ${start}-${body.length - 1}/${body.length}`,
        'content-length': body.length - start,
      });
      response.end(body.subarray(start));
      return;
    }
    response.writeHead(200, { 'content-length': body.length });
    response.end(body);
  };
  const { url, close } = await listen(handler);
  const asset = {
    name: 'model.gguf',
    url: `${url}/model.gguf`,
    sizeBytes: CONTENT.length,
    sha256: SHA256,
  };
  return { asset, requests, close };
}

describe('downloadVerified', () => {
  let dir: string;
  let destination: string;
  let fixture: Fixture | undefined;
  let events: ProgressEvent[];
  const ctx = { onProgress: (event: ProgressEvent) => events.push(event) };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sarmata-download-'));
    destination = join(dir, 'models', 'model.gguf');
    events = [];
  });

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
    await rm(dir, { recursive: true, force: true });
  });

  it('downloads once, writes the marker and leaves no partial file or lock', async () => {
    fixture = await serve();
    await downloadVerified(fixture.asset, destination, ctx);
    expect(await readFile(destination)).toEqual(CONTENT);
    expect(await readFile(`${destination}.sha256`, 'utf8')).toBe(SHA256);
    expect(existsSync(`${destination}.part`)).toBe(false);
    expect(existsSync(`${destination}.lock`)).toBe(false);
    expect(fixture.requests).toEqual([{ range: undefined }]);
  });

  it('skips a verified file without any request (a re-run from another worktree)', async () => {
    fixture = await serve();
    await downloadVerified(fixture.asset, destination, ctx);
    await downloadVerified(fixture.asset, destination, ctx);
    expect(fixture.requests).toHaveLength(1);
  });

  it('hashes a complete file without its marker instead of downloading it again', async () => {
    fixture = await serve();
    await downloadVerified(fixture.asset, destination, ctx);
    await rm(`${destination}.sha256`);
    await downloadVerified(fixture.asset, destination, ctx);
    expect(fixture.requests).toHaveLength(1);
    expect(await readFile(`${destination}.sha256`, 'utf8')).toBe(SHA256);
  });

  it('downloads again when a file of the right size has the wrong content', async () => {
    fixture = await serve();
    await downloadVerified(fixture.asset, destination, ctx);
    await writeFile(destination, Buffer.alloc(CONTENT.length, 0));
    await rm(`${destination}.sha256`);
    await downloadVerified(fixture.asset, destination, ctx);
    expect(fixture.requests).toHaveLength(2);
    expect(await readFile(destination)).toEqual(CONTENT);
  });

  it('resumes a partial download with a Range request', async () => {
    fixture = await serve();
    const half = Math.floor(CONTENT.length / 2);
    await writePartial(destination, CONTENT.subarray(0, half));
    await downloadVerified(fixture.asset, destination, ctx);
    expect(fixture.requests).toEqual([{ range: `bytes=${half}-` }]);
    expect(await readFile(destination)).toEqual(CONTENT);
    expect(events).toContainEqual({
      kind: 'step',
      message: 'Wznowienie pobierania model.gguf od 50%',
    });
  });

  it('starts over when the server ignores the range', async () => {
    fixture = await serve({ ranges: false });
    await writePartial(destination, CONTENT.subarray(0, 100));
    await downloadVerified(fixture.asset, destination, ctx);
    expect(fixture.requests).toEqual([{ range: 'bytes=100-' }, { range: undefined }]);
    expect(await readFile(destination)).toEqual(CONTENT);
  });

  it('finishes a complete partial file without a request', async () => {
    fixture = await serve();
    await writePartial(destination, CONTENT);
    await downloadVerified(fixture.asset, destination, ctx);
    expect(fixture.requests).toEqual([]);
    expect(await readFile(`${destination}.sha256`, 'utf8')).toBe(SHA256);
  });

  it('deletes a corrupt resumed download and reports the checksum', async () => {
    fixture = await serve();
    await writePartial(destination, Buffer.alloc(100, 1));
    await expect(downloadVerified(fixture.asset, destination, ctx)).rejects.toThrow(
      /Checksum mismatch for model.gguf/,
    );
    expect(existsSync(`${destination}.part`)).toBe(false);
    expect(existsSync(destination)).toBe(false);
  });

  it('refuses to download while another live process holds the lock', async () => {
    fixture = await serve();
    await writePartial(destination, Buffer.alloc(0));
    await writeFile(`${destination}.lock`, String(process.pid));
    await expect(downloadVerified(fixture.asset, destination, ctx)).rejects.toThrow(
      `model.gguf is being downloaded by another process (pid ${process.pid}`,
    );
    expect(fixture.requests).toEqual([]);
  });

  it('takes over the lock of a process that is gone', async () => {
    fixture = await serve();
    await writePartial(destination, Buffer.alloc(0));
    await writeFile(`${destination}.lock`, String(DEAD_PID));
    await downloadVerified(fixture.asset, destination, ctx);
    expect(await readFile(destination)).toEqual(CONTENT);
    expect(existsSync(`${destination}.lock`)).toBe(false);
  });
});

describe('lockFile', () => {
  it('can be taken again after release', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sarmata-lock-'));
    const path = join(dir, 'x.lock');
    const release = await lockFile(path, 'x');
    await expect(lockFile(path, 'x')).rejects.toThrow(/another process/);
    await release();
    const again = await lockFile(path, 'x');
    await again();
    await rm(dir, { recursive: true, force: true });
  });
});

async function writePartial(destination: string, content: Buffer): Promise<void> {
  await mkdir(join(destination, '..'), { recursive: true });
  await writeFile(`${destination}.part`, content);
}
