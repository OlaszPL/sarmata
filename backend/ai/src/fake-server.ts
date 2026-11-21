import {
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from 'node:http';
import { type AddressInfo } from 'node:net';

export interface RecordedRequest {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly headers: IncomingHttpHeaders;
  readonly body: unknown;
}

export interface FakeReply {
  readonly status: number;
  readonly body: unknown;
  readonly delayMs?: number;
}

export interface FakeServer {
  readonly baseUrl: string;
  readonly requests: RecordedRequest[];
  close(): Promise<void>;
}

export async function startFakeServer(
  reply: (request: RecordedRequest) => FakeReply,
): Promise<FakeServer> {
  const requests: RecordedRequest[] = [];
  const respond = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let data = '';
    for await (const chunk of req) data += String(chunk);
    const recorded: RecordedRequest = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: data === '' ? null : (JSON.parse(data) as unknown),
    };
    requests.push(recorded);
    const answer = reply(recorded);
    if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));
    res.writeHead(answer.status, { 'content-type': 'application/json' });
    res.end(typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body));
  };
  const server = createServer((req, res) => {
    void respond(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
