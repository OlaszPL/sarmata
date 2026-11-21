import { type CalendarDate, type TermChangeReason } from '@sarmata/domain';
import { type EvaluationEvent } from '@sarmata/repositories';
import { formatDate } from './format';
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
  /** What happened, read from the payload: outcome, reasons, new dates, refusal note, place. */
  readonly details: string;
}

export interface EventLog {
  readonly officeName: string;
  readonly title: string;
  readonly subject: string;
  readonly columns: readonly [string, string, string, string, string, string, string];
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
    columns: [
      'Zdarzenie',
      'Data zdarzenia',
      'Czas wpisu',
      'Konto',
      'Wersja',
      'SHA-256',
      'Szczegóły',
    ],
    rows: view.events.map((event) => ({
      kind: event.kind,
      label: texts.eventLabels[event.kind],
      occurredOn: event.occurredOn,
      recordedAt: event.recordedAt,
      recordedBy: source.accountNames.get(event.recordedBy) ?? event.recordedBy,
      sheetVersion:
        typeof event.payload.sheetVersion === 'number' ? event.payload.sheetVersion : null,
      sheetSha256: typeof event.payload.sheetSha256 === 'string' ? event.payload.sheetSha256 : null,
      details: eventDetails(event, source, texts.termReasons),
    })),
  };
}

const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  rejected: 'sprzeciw nieuwzględniony, ocena bez zmian',
  changed: 'sprzeciw uwzględniony, ocena zmieniona',
  redraft: 'sprzeciw uwzględniony, ocena do ponownego sporządzenia',
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const dateText = (value: unknown): string | null => {
  const raw = text(value);
  return raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? formatDate(raw) : raw;
};

/** One readable line per event, in Polish, so the case file shows what was decided and why. */
export function eventDetails(
  event: EvaluationEvent,
  source: ExportSource,
  termReasons: Readonly<Record<TermChangeReason, string>>,
): string {
  const payload = event.payload;
  const parts: string[] = [];
  const add = (label: string, value: string | null) => {
    if (value !== null) parts.push(`${label}: ${value}`);
  };
  const account = (value: unknown) => {
    const id = text(value);
    return id === null ? null : (source.accountNames.get(id) ?? id);
  };
  switch (event.kind) {
    case 'objection_outcome': {
      const outcome = text(payload.outcome);
      add('Rozstrzygnięcie', outcome === null ? null : (OUTCOME_LABELS[outcome] ?? outcome));
      // The stored reason of a changed outcome is the technical marker `objection`, not a text.
      add('Uzasadnienie', text(payload.justification));
      add('Notatka', text(payload.note));
      add('Nowy termin', dateText(payload.newDueOn));
      return `${parts.join('. ')}${parts.length > 0 ? '.' : ''}`;
    }
    case 'term_changed': {
      add('Nowy termin', dateText(payload.newDueOn));
      const reason = text(payload.reason);
      add(
        'Przyczyna',
        reason === null
          ? null
          : ((termReasons as Readonly<Record<string, string | undefined>>)[reason] ?? reason),
      );
      add('Zawiadomienie z dnia', dateText(payload.noticeOn));
      return `${parts.join('. ')}${parts.length > 0 ? '.' : ''}`;
    }
    case 'absence':
      add('Nieobecność od', dateText(payload.from));
      add('do', dateText(payload.to) ?? 'nie wpisano');
      return `${parts.join(', ')}.`;
    case 'evaluator_changed':
      add('Poprzedni oceniający', account(payload.from));
      add('Nowy oceniający', account(payload.to));
      break;
    case 'position_changed':
      add('Nowe stanowisko', text(payload.positionTitle));
      add('Komórka', text(payload.orgUnit));
      if (typeof payload.significant === 'boolean') {
        add('Istotna zmiana', payload.significant ? 'tak' : 'nie');
      }
      add('Uzasadnienie', text(payload.justification));
      return `${parts.join('. ')}${parts.length > 0 ? '.' : ''}`;
    case 'closed':
      if (payload.automatic === true) parts.push('Zamknięcie automatyczne po terminie na sprzeciw');
      break;
    default:
      break;
  }
  const reasonLabel =
    event.kind === 'correction'
      ? 'Powód korekty'
      : event.kind === 'interrupted'
        ? 'Przyczyna przerwania'
        : 'Powód';
  add(reasonLabel, text(payload.reason));
  add('Notatka', text(payload.note));
  add('Notatka o odmowie podpisu', text(payload.refusalNote));
  if (Array.isArray(payload.witnesses)) {
    const witnesses = payload.witnesses.filter(
      (name): name is string => typeof name === 'string' && name.trim() !== '',
    );
    add('Świadkowie', witnesses.length === 0 ? null : witnesses.join(', '));
  }
  add('Miejscowość', text(payload.place));
  return `${parts.join('. ')}${parts.length > 0 ? '.' : ''}`;
}
