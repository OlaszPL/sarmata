export type ExportErrorCode =
  'not_found' | 'not_exportable' | 'unknown_event' | 'unsupported_regulation';

/** An expected failure of an export. The route handler maps `code` to an HTTP status. */
export class ExportError extends Error {
  readonly code: ExportErrorCode;

  constructor(code: ExportErrorCode, message: string) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}
