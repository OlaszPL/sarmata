export type LogFields = Record<string, unknown>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const line = (level: string, message: string, fields: LogFields = {}): string =>
  JSON.stringify({ level, time: new Date().toISOString(), message, ...fields });

/** One JSON object per line on stdout and stderr, readable by `docker logs`. */
export const jsonLogger: Logger = {
  info: (message, fields) => {
    console.log(line('info', message, fields));
  },
  error: (message, fields) => {
    console.error(line('error', message, fields));
  },
};

export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
