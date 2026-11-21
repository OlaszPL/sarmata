import { createServer, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Test-only HTTP server on a random local port. Not exported from index.ts. */
export async function listen(
  handler: RequestListener,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** A local port that nothing listens on right now. */
export async function freePort(): Promise<number> {
  const { url, close } = await listen(() => undefined);
  await close();
  return Number(new URL(url).port);
}
