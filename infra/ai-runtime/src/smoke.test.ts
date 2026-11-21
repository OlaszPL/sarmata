import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { smokeDecision, smokeText } from './smoke.ts';
import { freePort, listen } from './test-helpers.ts';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;
const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

describe('smoke checks', () => {
  let close: (() => Promise<void>) | undefined;
  const serve = async (handler: Handler): Promise<string> => {
    const server = await listen(handler);
    close = server.close;
    return server.url;
  };

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it('reports the answer and latency of a running text model', async () => {
    const url = await serve((request, response) => {
      if (request.url === '/v1/health') {
        json(response, 200, { status: 'ok' });
        return;
      }
      json(response, 200, {
        choices: [{ message: { content: ' Ocena okresowa to\nocena pracy. ' } }],
      });
    });
    const result = await smokeText(`${url}/v1`, 'bielik');
    expect(result).toMatchObject({ status: 'ok', detail: 'Ocena okresowa to ocena pracy.' });
    expect(result.status === 'ok' && result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('says the text model is not running when nothing listens', async () => {
    const url = `http://127.0.0.1:${await freePort()}/v1`;
    expect(await smokeText(url, 'bielik')).toEqual({
      status: 'not-running',
      detail: `nic nie odpowiada pod ${url}`,
    });
  });

  it('fails on an empty completion', async () => {
    const url = await serve((request, response) => {
      if (request.url === '/v1/health') {
        json(response, 200, { status: 'ok' });
        return;
      }
      json(response, 200, { choices: [{ message: { content: '' } }] });
    });
    expect((await smokeText(`${url}/v1`, 'bielik')).status).toBe('failed');
  });

  it('reports the probability of a running Bielik-One', async () => {
    const url = await serve((request, response) => {
      if (request.url === '/health') {
        json(response, 200, { status: 'ok', calibrated: true });
        return;
      }
      json(response, 200, { answers: { filed: { probabilities: { true: 0.97, false: 0.03 } } } });
    });
    expect(await smokeDecision(url)).toMatchObject({
      status: 'ok',
      detail: '„Czy wniosek został złożony?” tak z p=0.970 (skalibrowane)',
    });
  });

  it('says Bielik-One is not running when nothing listens', async () => {
    const url = `http://127.0.0.1:${await freePort()}`;
    expect((await smokeDecision(url)).status).toBe('not-running');
  });

  it('fails while the backend is still loading', async () => {
    const url = await serve((_request, response) => {
      json(response, 503, { status: 'loading' });
    });
    expect(await smokeDecision(url)).toMatchObject({ status: 'failed' });
  });
});
