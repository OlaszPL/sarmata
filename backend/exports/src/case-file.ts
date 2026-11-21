import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { type EventLog, buildEventLog } from './event-log';
import { buildNoticeDocument } from './notice-document';
import { renderEventLogPdf } from './pdf/event-log-template';
import { renderNoticePdf } from './pdf/notice-template';
import { renderSheetPdf } from './pdf/sheet-template';
import { buildSheetDocument, termNotices, type ExportSource } from './sheet-document';

export interface PackageFile {
  readonly path: string;
  readonly bytes: Uint8Array;
  /** Short Polish description for the manifest. */
  readonly description: string;
}

export const sha256Hex = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

/** One CSV field as RFC 4180 wants it: quoted when it holds a comma, a quote or a line break. */
const csvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

/** The event log as RFC 4180 CSV in UTF-8 (CRLF line ends, header row first). */
export function eventLogCsv(log: EventLog): string {
  const header = [
    'rodzaj',
    'zdarzenie',
    'data_zdarzenia',
    'czas_wpisu',
    'konto',
    'wersja',
    'sha256',
  ];
  const rows = log.rows.map((row) => [
    row.kind,
    row.label,
    row.occurredOn,
    row.recordedAt,
    row.recordedBy,
    row.sheetVersion === null ? '' : String(row.sheetVersion),
    row.sheetSha256 ?? '',
  ]);
  return [header, ...rows].map((line) => line.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** Paths of the notice PDFs, `zawiadomienia/zmiana-terminu-<noticeOn>.pdf`, numbered on equal dates. */
export function noticePaths(source: ExportSource): { eventId: string; path: string }[] {
  const used = new Map<string, number>();
  return termNotices(source).map((notice) => {
    const count = (used.get(notice.noticeOn) ?? 0) + 1;
    used.set(notice.noticeOn, count);
    const suffix = count === 1 ? '' : `-${String(count)}`;
    return {
      eventId: notice.eventId,
      path: `zawiadomienia/zmiana-terminu-${notice.noticeOn}${suffix}.pdf`,
    };
  });
}

/** Zips the files with a fixed modification time, so the same files give the same archive. */
export function zipFiles(files: readonly PackageFile[], at: Date): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.path] = file.bytes;
  return zipSync(entries, { mtime: at });
}

/**
 * The case file (teczka sprawy): the current sheet, every version, the event log (PDF and CSV), the
 * term notices and `manifest.json` with the SHA-256 of every other file.
 */
export function buildCaseFile(source: ExportSource, at: Date): Uint8Array {
  const options = { standard: 'ua-1', createdAt: at } as const;
  const current = buildSheetDocument(source, { signatureBox: false });
  const log = buildEventLog(source);
  const files: PackageFile[] = [
    {
      path: 'arkusz.pdf',
      bytes: renderSheetPdf(current, options),
      description: `Arkusz ${source.view.sheetId}, bieżąca wersja ${String(current.version.number)}`,
    },
  ];
  for (const stored of source.sheetVersions) {
    const document = buildSheetDocument(source, { version: stored.version, signatureBox: false });
    files.push({
      path: `wersje/arkusz-v${String(stored.version)}.pdf`,
      bytes: renderSheetPdf(document, options),
      description: `Arkusz, wersja ${String(stored.version)} (${stored.state})`,
    });
  }
  files.push(
    {
      path: 'dziennik-zdarzen.pdf',
      bytes: renderEventLogPdf(log, options),
      description: 'Dziennik zdarzeń oceny (PDF)',
    },
    {
      path: 'dziennik-zdarzen.csv',
      bytes: strToU8(eventLogCsv(log)),
      description: 'Dziennik zdarzeń oceny (CSV, UTF-8)',
    },
  );
  for (const { eventId, path } of noticePaths(source)) {
    files.push({
      path,
      bytes: renderNoticePdf(
        buildNoticeDocument(source, eventId, { signatureBox: false }),
        options,
      ),
      description: 'Zawiadomienie o zmianie terminu sporządzenia oceny',
    });
  }
  const manifest = {
    evaluationId: source.view.id,
    files: files.map((file) => ({
      file: file.path,
      sha256: sha256Hex(file.bytes),
      description: file.description,
    })),
  };
  files.push({
    path: 'manifest.json',
    bytes: strToU8(JSON.stringify(manifest, null, 2)),
    description: 'Spis plików ze skrótami SHA-256',
  });
  return zipFiles(files, at);
}
