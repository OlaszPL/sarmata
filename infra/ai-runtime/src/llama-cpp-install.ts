import { lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { RuntimeContext } from './context.ts';
import { downloadVerified, readTextOrNull } from './download.ts';
import { LLAMA_CPP_RELEASE, type LlamaBackend, type LlamaCppBundle } from './llama-cpp-release.ts';

/** An installed llama.cpp: the directory with llama-server, llama-bench and their libraries. */
export interface LlamaCpp {
  dir: string;
  serverPath: string;
  benchPath: string;
  backend: LlamaBackend;
  build: string;
}

const INSTALL_MARKER = '.sarmata-install.json';

/**
 * Downloads, verifies and unpacks a llama.cpp bundle into `<dataDir>/llama.cpp/<build>-<key>`.
 * Extra archives (the CUDA runtime) land next to llama-server so it finds their libraries.
 * A finished install of the same archives is reused without downloading.
 */
export async function installLlamaCpp(
  bundle: LlamaCppBundle,
  ctx: RuntimeContext,
): Promise<LlamaCpp> {
  const dir = join(ctx.dataDir, 'llama.cpp', `${LLAMA_CPP_RELEASE.build}-${bundle.key}`);
  const exe = ctx.machine.os === 'windows' ? '.exe' : '';
  const llama: LlamaCpp = {
    dir,
    serverPath: join(dir, `llama-server${exe}`),
    benchPath: join(dir, `llama-bench${exe}`),
    backend: bundle.backend,
    build: LLAMA_CPP_RELEASE.build,
  };
  const fingerprint = JSON.stringify(bundle.assets.map((asset) => asset.sha256));
  if ((await readTextOrNull(join(dir, INSTALL_MARKER))) === fingerprint) return llama;

  const staging = `${dir}.staging`;
  await rm(dir, { recursive: true, force: true });
  await rm(staging, { recursive: true, force: true });
  await mkdir(dirname(dir), { recursive: true });
  for (const [index, asset] of bundle.assets.entries()) {
    ctx.onProgress?.({ kind: 'step', message: `Pobieranie ${asset.name}` });
    const archive = await downloadVerified(asset, join(ctx.dataDir, 'downloads', asset.name), ctx);
    const target = join(staging, String(index));
    await mkdir(target, { recursive: true });
    ctx.onProgress?.({ kind: 'step', message: `Rozpakowywanie ${asset.name}` });
    const unpacked = await ctx.machine.run('tar', ['-xf', archive, '-C', target]);
    if (unpacked.exitCode !== 0) {
      throw new Error(`Unpacking ${asset.name} failed: ${unpacked.stderr.trim()}`);
    }
    if (index === 0) {
      const server = await findFile(target, basename(llama.serverPath));
      if (!server) throw new Error(`${asset.name} does not contain ${basename(llama.serverPath)}`);
      await rename(dirname(server), dir);
    } else {
      await moveFilesFlat(target, dir);
    }
    await rm(archive, { force: true });
    await rm(`${archive}.sha256`, { force: true });
  }
  await rm(staging, { recursive: true, force: true });
  await writeFile(join(dir, INSTALL_MARKER), fingerprint);
  return llama;
}

async function findFile(root: string, name: string): Promise<string | null> {
  const entries = await readdir(root, { recursive: true });
  const match = entries.find((entry) => basename(entry) === name);
  return match === undefined ? null : join(root, match);
}

async function moveFilesFlat(from: string, to: string): Promise<void> {
  for (const entry of await readdir(from, { recursive: true })) {
    const source = join(from, entry);
    if ((await lstat(source)).isDirectory()) continue;
    const target = join(to, basename(entry));
    await rm(target, { force: true });
    await rename(source, target);
  }
}
