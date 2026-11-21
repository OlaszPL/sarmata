import { createHash, type Hash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { DownloadAsset, RuntimeContext } from './context.ts';

const REPORT_EVERY_BYTES = 16 * 1024 * 1024;

/**
 * Downloads `asset` to `destination` once per machine and checks its size and SHA-256. Every
 * worktree shares the data directory, so a re-run anywhere finds the verified file and skips it.
 * A complete file without its `.sha256` marker is hashed instead of downloaded again, and a
 * `.part` left by an interrupted run is resumed with an HTTP Range request. A lock file keeps two
 * runs (two worktrees) from writing the same file. A wrong download is deleted and reported.
 */
export async function downloadVerified(
  asset: DownloadAsset,
  destination: string,
  ctx: Pick<RuntimeContext, 'onProgress'>,
): Promise<string> {
  if (await isVerified(asset, destination)) return destination;
  await mkdir(dirname(destination), { recursive: true });
  const unlock = await lockFile(`${destination}.lock`, asset.name);
  try {
    // Another run may have finished the file while this one waited for the lock.
    if (await isVerified(asset, destination)) return destination;
    const marker = `${destination}.sha256`;
    await rm(marker, { force: true });
    if ((await sizeOrNull(destination)) === asset.sizeBytes) {
      ctx.onProgress?.({ kind: 'step', message: `Sprawdzanie sumy kontrolnej ${asset.name}` });
      if ((await sha256OfFile(destination)) === asset.sha256) {
        await writeFile(marker, asset.sha256);
        return destination;
      }
    }
    await rm(destination, { force: true });
    const partial = `${destination}.part`;
    const { sha256, size } = await fetchToPartial(asset, partial, ctx);
    if (size !== asset.sizeBytes || sha256 !== asset.sha256) {
      await rm(partial, { force: true });
      throw new Error(
        `Checksum mismatch for ${asset.name}: expected ${asset.sha256} (${asset.sizeBytes} B), got ${sha256} (${size} B)`,
      );
    }
    await rename(partial, destination);
    await writeFile(marker, asset.sha256);
    return destination;
  } finally {
    await unlock();
  }
}

async function isVerified(asset: DownloadAsset, destination: string): Promise<boolean> {
  const marker = await readTextOrNull(`${destination}.sha256`);
  return marker === asset.sha256 && (await sizeOrNull(destination)) === asset.sizeBytes;
}

/**
 * Fills `partial` up to the asset size, resuming from what is already there. Returns the SHA-256
 * and size of the whole file.
 */
async function fetchToPartial(
  asset: DownloadAsset,
  partial: string,
  ctx: Pick<RuntimeContext, 'onProgress'>,
): Promise<{ sha256: string; size: number }> {
  let offset = (await sizeOrNull(partial)) ?? 0;
  if (offset > asset.sizeBytes) {
    await rm(partial, { force: true });
    offset = 0;
  }
  let hash = createHash('sha256');
  if (offset > 0) await hashFileInto(partial, hash);
  if (offset === asset.sizeBytes) return { sha256: hash.digest('hex'), size: offset };

  let response = await fetch(
    asset.url,
    offset > 0 ? { headers: { range: `bytes=${offset}-` } } : undefined,
  );
  const resumed =
    offset > 0 &&
    response.status === 206 &&
    (response.headers.get('content-range') ?? '').startsWith(`bytes ${offset}-`);
  if (offset > 0 && !resumed) {
    // The server ignored or refused the range: start over from the first byte.
    await response.body?.cancel();
    await rm(partial, { force: true });
    offset = 0;
    hash = createHash('sha256');
    response = await fetch(asset.url);
  }
  if (!response.ok || !response.body) {
    throw new Error(`Download of ${asset.name} failed with HTTP ${response.status}: ${asset.url}`);
  }
  if (resumed) {
    ctx.onProgress?.({
      kind: 'step',
      message: `Wznowienie pobierania ${asset.name} od ${Math.floor((offset / asset.sizeBytes) * 100)}%`,
    });
  }
  const file = await open(partial, resumed ? 'a' : 'w');
  let received = offset;
  let reported = offset;
  try {
    // The web stream yields Uint8Array chunks, but its Node typings iterate as any.
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      await file.write(chunk);
      received += chunk.byteLength;
      if (received - reported >= REPORT_EVERY_BYTES || received === asset.sizeBytes) {
        reported = received;
        ctx.onProgress?.({
          kind: 'download',
          file: asset.name,
          receivedBytes: received,
          totalBytes: asset.sizeBytes,
        });
      }
    }
  } finally {
    await file.close();
  }
  return { sha256: hash.digest('hex'), size: received };
}

async function hashFileInto(path: string, hash: Hash): Promise<void> {
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
}

/** SHA-256 of a file on disk, streamed. */
export async function sha256OfFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  await hashFileInto(path, hash);
  return hash.digest('hex');
}

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/**
 * Takes `path` as a lock holding this process id, and returns its release. A lock whose process
 * is gone (a killed run) is taken over. A live one fails with a message naming its process.
 */
export async function lockFile(path: string, name: string): Promise<() => Promise<void>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(path, 'wx');
      await handle.writeFile(String(process.pid));
      await handle.close();
      return () => rm(path, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const pid = Number((await readTextOrNull(path))?.trim());
      if (Number.isInteger(pid) && pid > 0 && isAlive(pid)) {
        throw new Error(
          `${name} is being downloaded by another process (pid ${pid}, lock ${path}). Wait until it finishes and run again.`,
          { cause: error },
        );
      }
      await rm(path, { force: true });
    }
  }
  throw new Error(`Could not lock ${path}`);
}

export async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function sizeOrNull(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}
