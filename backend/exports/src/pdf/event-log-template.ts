import { formatDate, formatDateTime } from '../format';
import { type EventLog } from '../event-log';
import { PREAMBLE } from './preamble';
import { type RenderOptions, renderPdf } from './typst';

export function eventLogTemplateData(log: EventLog) {
  return {
    title: log.title,
    author: log.officeName,
    isDraft: false,
    draftMark: '',
    heading: log.title,
    subject: log.subject,
    columns: log.columns,
    rows: log.rows.map((row) => ({
      label: row.label,
      occurredOn: formatDate(row.occurredOn),
      recordedAt: formatDateTime(row.recordedAt),
      recordedBy: row.recordedBy,
      version: row.sheetVersion === null ? '' : String(row.sheetVersion),
      sha1: row.sheetSha256?.slice(0, 32) ?? '',
      sha2: row.sheetSha256?.slice(32) ?? '',
      details: row.details,
    })),
  };
}

export const EVENT_LOG_TEMPLATE = `${PREAMBLE}${String.raw`
= #data.heading

#data.subject

#table(
  columns: (auto, auto, auto, auto, auto, auto, 1fr),
  table.header(..data.columns.map(c => [#strong(c)])),
  ..data.rows.map(r => (
    [#r.label],
    [#r.occurredOn],
    [#r.recordedAt],
    [#r.recordedBy],
    [#r.version],
    text(size: 6.5pt)[#r.sha1 \ #r.sha2],
    [#r.details],
  )).flatten(),
)
`}`;

export function renderEventLogPdf(log: EventLog, options: RenderOptions): Uint8Array {
  return renderPdf(EVENT_LOG_TEMPLATE, eventLogTemplateData(log), options);
}
