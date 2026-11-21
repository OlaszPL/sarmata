import { type CalendarDate } from '@sarmata/domain';
import { type ExportSource, textsFor } from './sheet-document';

export interface EventLogRow {
  readonly kind: string;
  /** Polish name of the event kind. */
  readonly label: string;
  readonly occurredOn: CalendarDate;
  readonly recordedAt: string;
  readonly recordedBy: string;
  /** Sheet version of the event, `null` for events that do not carry one. */
  readonly sheetVersion: number | null;
  readonly sheetSha256: string | null;
}

export interface EventLog {
  readonly officeName: string;
  readonly title: string;
  readonly subject: string;
  readonly columns: readonly [string, string, string, string, string, string];
  readonly rows: EventLogRow[];
}

/** Every event of the evaluation, oldest first: the append-only record of ADR 0007. */
export function buildEventLog(source: ExportSource): EventLog {
  const texts = textsFor(source.regulation);
  const { view } = source;
  return {
    officeName: source.officeName,
    title: 'Dziennik zdarzeń oceny okresowej',
    subject: `${view.snapshot.firstName} ${view.snapshot.lastName}, arkusz ${view.sheetId}`,
    columns: ['Zdarzenie', 'Data zdarzenia', 'Czas wpisu', 'Konto', 'Wersja', 'SHA-256'],
    rows: view.events.map((event) => ({
      kind: event.kind,
      label: texts.eventLabels[event.kind],
      occurredOn: event.occurredOn,
      recordedAt: event.recordedAt,
      recordedBy: source.accountNames.get(event.recordedBy) ?? event.recordedBy,
      sheetVersion:
        typeof event.payload.sheetVersion === 'number' ? event.payload.sheetVersion : null,
      sheetSha256: typeof event.payload.sheetSha256 === 'string' ? event.payload.sheetSha256 : null,
    })),
  };
}
