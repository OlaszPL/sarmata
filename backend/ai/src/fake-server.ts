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

const schemaNameOf = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null || !('response_format' in body)) return null;
  const format = body.response_format;
  if (typeof format !== 'object' || format === null || !('json_schema' in format)) return null;
  const schema = format.json_schema;
  if (typeof schema !== 'object' || schema === null || !('name' in schema)) return null;
  return typeof schema.name === 'string' ? schema.name : null;
};

/**
 * Replies like the model servers: a chat completion with `objects[<schema name>]` as JSON content
 * (by `response_format.json_schema.name`) and the Bielik-One answers from `decision` on `/systemone`.
 * Anything else gets HTTP 500.
 */
export function modelReplies(replies: {
  readonly objects?: Record<string, unknown>;
  readonly decision?: unknown;
}): (request: RecordedRequest) => FakeReply {
  return (request) => {
    if (request.url?.endsWith('/systemone') && replies.decision !== undefined) {
      return { status: 200, body: replies.decision };
    }
    const name = schemaNameOf(request.body);
    const object = name === null ? undefined : replies.objects?.[name];
    if (object === undefined) return { status: 500, body: { error: `no reply for ${name}` } };
    return {
      status: 200,
      body: { choices: [{ message: { role: 'assistant', content: JSON.stringify(object) } }] },
    };
  };
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
