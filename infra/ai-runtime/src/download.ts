import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { DownloadAsset, RuntimeContext } from './context.ts';

const REPORT_EVERY_BYTES = 16 * 1024 * 1024;

/**
 * Downloads `asset` to `destination` and checks its size and SHA-256. A file verified earlier is
 * kept without a new download. A wrong download is deleted and reported as an error.
 */
export async function downloadVerified(
  asset: DownloadAsset,
  destination: string,
  ctx: Pick<RuntimeContext, 'onProgress'>,
): Promise<string> {
  const marker = `${destination}.sha256`;
  const verified = (await readTextOrNull(marker)) === asset.sha256;
  if (verified && (await sizeOrNull(destination)) === asset.sizeBytes) return destination;

  await mkdir(dirname(destination), { recursive: true });
  await rm(marker, { force: true });
  const partial = `${destination}.part`;
  const response = await fetch(asset.url);
  if (!response.ok || !response.body) {
    throw new Error(`Download of ${asset.name} failed with HTTP ${response.status}: ${asset.url}`);
  }
  const hash = createHash('sha256');
  const file = await open(partial, 'w');
  let received = 0;
  let reported = 0;
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
  const sha256 = hash.digest('hex');
  if (received !== asset.sizeBytes || sha256 !== asset.sha256) {
    await rm(partial, { force: true });
    throw new Error(
      `Checksum mismatch for ${asset.name}: expected ${asset.sha256} (${asset.sizeBytes} B), got ${sha256} (${received} B)`,
    );
  }
  await rename(partial, destination);
  await writeFile(marker, asset.sha256);
  return destination;
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
