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
  /** Server-sent events instead of `body`: each one as `data: <json>`, then `data: [DONE]`. */
  readonly events?: readonly unknown[];
  /** Pause before every event, so a test can watch the progress of a stream. */
  readonly eventDelayMs?: number;
}

export interface StreamOptions {
  /** Characters per streamed piece, one piece counts as one token. Default 4. */
  readonly pieceChars?: number;
  readonly eventDelayMs?: number;
  readonly finishReason?: 'stop' | 'length';
}

/**
 * A chat completion as llama-server streams it: content pieces, the finish reason, then the usage
 * (`stream_options.include_usage`).
 */
export function completionEvents(content: string, options: StreamOptions = {}): unknown[] {
  const size = options.pieceChars ?? 4;
  const pieces: string[] = [];
  for (let start = 0; start < content.length; start += size) {
    pieces.push(content.slice(start, start + size));
  }
  return [
    ...pieces.map((piece) => ({
      choices: [{ index: 0, delta: { content: piece }, finish_reason: null }],
    })),
    { choices: [{ index: 0, delta: {}, finish_reason: options.finishReason ?? 'stop' }] },
    {
      choices: [],
      usage: {
        prompt_tokens: 100,
        completion_tokens: pieces.length,
        total_tokens: 100 + pieces.length,
      },
    },
  ];
}

const isStream = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && 'stream' in body && body.stream === true;

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

/** The user message of a chat completion request, e.g. to answer per criterion. */
export const promptOf = (request: RecordedRequest): string => {
  const body = request.body as { messages?: { role: string; content: string }[] } | null;
  return body?.messages?.find((message) => message.role === 'user')?.content ?? '';
};

/**
 * Replies like the model servers: a chat completion with `objects[<schema name>]` as JSON content
 * (by `response_format.json_schema.name`) and the Bielik-One answers from `decision` on `/systemone`.
 * An object may be a function of the request. A request with `stream: true` gets the content as
 * server-sent events (`stream` options). Anything else gets HTTP 500.
 */
export function modelReplies(
  replies: {
    readonly objects?: Record<string, unknown>;
    readonly decision?: unknown;
  },
  stream: StreamOptions = {},
): (request: RecordedRequest) => FakeReply {
  return (request) => {
    if (request.url?.endsWith('/systemone') && replies.decision !== undefined) {
      return { status: 200, body: replies.decision };
    }
    const name = schemaNameOf(request.body);
    const entry = name === null ? undefined : replies.objects?.[name];
    const object: unknown =
      typeof entry === 'function'
        ? (entry as (request: RecordedRequest) => unknown)(request)
        : entry;
    if (object === undefined) return { status: 500, body: { error: `no reply for ${name}` } };
    const content = typeof object === 'string' ? object : JSON.stringify(object);
    if (isStream(request.body)) {
      return {
        status: 200,
        body: null,
        events: completionEvents(content, stream),
        ...(stream.eventDelayMs === undefined ? {} : { eventDelayMs: stream.eventDelayMs }),
      };
    }
    return {
      status: 200,
      body: { choices: [{ message: { role: 'assistant', content } }] },
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
    const pause = (ms: number | undefined) =>
      ms ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
    await pause(answer.delayMs);
    if (answer.events) {
      res.writeHead(answer.status, { 'content-type': 'text/event-stream' });
      for (const event of answer.events) {
        await pause(answer.eventDelayMs);
        if (res.destroyed) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.end('data: [DONE]\n\n');
      return;
    }
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
