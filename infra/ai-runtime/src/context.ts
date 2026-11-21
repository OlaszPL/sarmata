import type { Machine } from './machine.ts';

/** A file to download, pinned by size and SHA-256. */
export interface DownloadAsset {
  name: string;
  url: string;
  sizeBytes: number;
  sha256: string;
}

/** Progress for the installer screen. `message` is user-facing, so it is in Polish. */
export type ProgressEvent =
  | { kind: 'step'; message: string }
  | { kind: 'download'; file: string; receivedBytes: number; totalBytes: number };

/** What installing and starting functions need: the machine and the app data directory. */
export interface RuntimeContext {
  machine: Machine;
  dataDir: string;
  onProgress?: (event: ProgressEvent) => void;
}
