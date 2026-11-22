// Type only: client components import these helpers, a value import would bundle `@sarmata/services`.
import type { AiRun, AiRunKind, AiRunStatus, AiUsageLogEntry } from '@sarmata/services';
import { pluralPl } from '@/lib/format';
import type { SearchParams } from '@/lib/search-params';
import { single } from '@/lib/search-params';

export const aiKindLabels: Record<AiRunKind, string> = {
  sheet_draft: 'Szkic arkusza',
  quality_check: 'Sprawdzenie jakości',
  sensitive_data: 'Dane wrażliwe w notatce',
  conversation_prep: 'Przygotowanie rozmowy',
  criteria_proposals: 'Propozycje kryteriów',
  appreciation_moments: 'Moment na docenienie',
  hr_signals: 'Sygnały HR partnera',
  procedure_question: 'Pytanie o procedurę',
};

export const aiKinds = Object.keys(aiKindLabels) as AiRunKind[];

export type StatusTone = 'waiting' | 'progress' | 'done' | 'attention';

export function runStatusTag(status: AiRunStatus): { tone: StatusTone; label: string } {
  switch (status) {
    case 'queued':
      return { tone: 'waiting', label: 'W kolejce' };
    case 'running':
      return { tone: 'progress', label: 'W toku' };
    case 'done':
      return { tone: 'done', label: 'Gotowe' };
    case 'failed':
      return { tone: 'attention', label: 'Nieudane' };
  }
}

const dateTimeParts = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** An ISO timestamp as `dd.mm.rrrr gg:mm` in Warsaw time. */
export function formatDateTime(iso: string): string {
  const parts = Object.fromEntries(
    dateTimeParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

type DecisionKind = 'accepted' | 'edited' | 'rejected';

export function decisionCounts(run: { decisions: readonly { decision: DecisionKind }[] }): {
  accepted: number;
  edited: number;
  rejected: number;
  pending: boolean;
} {
  const count = (kind: DecisionKind) =>
    run.decisions.filter((entry) => entry.decision === kind).length;
  return {
    accepted: count('accepted'),
    edited: count('edited'),
    rejected: count('rejected'),
    pending: run.decisions.length === 0,
  };
}

export interface AiLogRow {
  id: string;
  requestedAt: string;
  kind: string;
  employee: string | null;
  requestedBy: string;
  status: { tone: StatusTone; label: string };
  decisions: string;
  evaluationId: string | null;
  contentDeleted: boolean;
}

function decisionsText(run: { decisions: readonly { decision: DecisionKind }[] }): string {
  const { accepted, edited, rejected, pending } = decisionCounts(run);
  if (pending) return 'Bez decyzji';
  return [
    `${accepted} ${pluralPl(accepted, 'przyjęta', 'przyjęte', 'przyjętych')}`,
    `${edited} ${pluralPl(edited, 'poprawiona', 'poprawione', 'poprawionych')}`,
    `${rejected} ${pluralPl(rejected, 'odrzucona', 'odrzucone', 'odrzuconych')}`,
  ].join(', ');
}

/** `people` maps employee ids and account ids to a display name. */
export function aiLogRows(runs: readonly AiRun[], people: ReadonlyMap<string, string>): AiLogRow[] {
  return runs.map((run) => ({
    id: run.id,
    requestedAt: formatDateTime(run.requestedAt),
    kind: aiKindLabels[run.kind],
    employee: run.employeeId === null ? null : (people.get(run.employeeId) ?? null),
    requestedBy: people.get(run.requestedBy) ?? 'Konto spoza akt',
    status: runStatusTag(run.status),
    decisions: decisionsText(run),
    evaluationId: run.evaluationId,
    contentDeleted: run.contentDeletedAt !== null,
  }));
}

/** Rows of the admin usage log: same shape as `aiLogRows`, the requester name comes with the entry. */
export function usageLogRows(
  entries: readonly AiUsageLogEntry[],
  people: ReadonlyMap<string, string>,
): AiLogRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    requestedAt: formatDateTime(entry.requestedAt),
    kind: aiKindLabels[entry.kind],
    employee: entry.employeeId === null ? null : (people.get(entry.employeeId) ?? null),
    requestedBy: entry.requesterName ?? people.get(entry.requestedBy) ?? 'Konto spoza akt',
    status: runStatusTag(entry.status),
    decisions: decisionsText(entry),
    evaluationId: entry.evaluationId,
    contentDeleted: entry.contentDeletedAt !== null,
  }));
}

/** The usage log narrowed by the page filter, in memory. */
export function filterUsageLog(
  entries: readonly AiUsageLogEntry[],
  filter: { employeeId?: string; kind?: AiRunKind },
): AiUsageLogEntry[] {
  return entries.filter(
    (entry) =>
      (filter.employeeId === undefined || entry.employeeId === filter.employeeId) &&
      (filter.kind === undefined || entry.kind === filter.kind),
  );
}

const failureReasonTexts: Record<string, string> = {
  disabled: 'AI jest wyłączone w ustawieniach urzędu',
  timeout: 'Model nie odpowiedział w wyznaczonym czasie',
  unavailable: 'Serwer modelu był niedostępny',
  rejected: 'Model odrzucił zapytanie',
  invalid_response: 'Model zwrócił odpowiedź w złym formacie',
  expired: 'Przebieg zbyt długo czekał w kolejce',
  interrupted: 'Przebieg przerwano przed końcem',
};

/** Short Polish text of a failure code. An unknown code is never shown raw, it is English. */
export function failureReasonText(reason: string): string {
  return failureReasonTexts[reason] ?? 'Inny błąd przebiegu';
}

const failureMessageTexts: Record<string, string> = {
  disabled: 'Przebieg nie ruszył, bo AI jest wyłączone w ustawieniach urzędu.',
  timeout: 'Model nie odpowiedział w wyznaczonym czasie. Uruchom przebieg ponownie później.',
  unavailable: 'Serwer modelu był niedostępny. Uruchom przebieg ponownie później.',
  rejected: 'Model odrzucił zapytanie. Zmień treść i uruchom przebieg ponownie.',
  invalid_response:
    'Model zwrócił odpowiedź w złym formacie, więc nie da się jej pokazać. Uruchom przebieg ponownie.',
  expired: 'Przebieg zbyt długo czekał w kolejce i wygasł. Uruchom go ponownie.',
  interrupted: 'Usługa AI zatrzymała się w trakcie przebiegu. Uruchom go ponownie.',
};

/**
 * Polish explanation of a failed run with what to do next. The worker stores its own message in
 * English (`failure.message`), so the log never shows it and reads the code instead.
 */
export function failureMessageText(reason: string): string {
  return failureMessageTexts[reason] ?? 'Przebieg się nie udał. Uruchom go ponownie później.';
}

export interface LogDecision {
  fragment: string;
  decision: DecisionKind;
  decidedBy: string;
  decidedAt: string;
  /** Text after an edit. Null for the admin log, which has no content. */
  finalText: string | null;
  contentDeletedAt: string | null;
}

/** One run as the details show it, whichever source it comes from. */
export interface LogRunDetail {
  id: string;
  kind: string;
  evaluationId: string | null;
  failureReason: string | null;
  /** Polish explanation of the failure (`failureMessageText`), null for a run that did not fail. */
  failureMessage: string | null;
  model: string | null;
  promptVersion: string | null;
  outputTokens: number | null;
  contentDeletedAt: string | null;
  decisions: LogDecision[];
}

export function runDetail(run: AiRun): LogRunDetail {
  return {
    id: run.id,
    kind: aiKindLabels[run.kind],
    evaluationId: run.evaluationId,
    failureReason: run.failure?.reason ?? null,
    failureMessage: run.failure ? failureMessageText(run.failure.reason) : null,
    model: run.model,
    promptVersion: run.promptVersion,
    outputTokens: run.outputTokens,
    contentDeletedAt: run.contentDeletedAt,
    decisions: run.decisions.map((entry) => ({ ...entry })),
  };
}

export function usageLogDetail(entry: AiUsageLogEntry): LogRunDetail {
  return {
    id: entry.id,
    kind: aiKindLabels[entry.kind],
    evaluationId: entry.evaluationId,
    failureReason: entry.failureReason,
    failureMessage: entry.failureReason === null ? null : failureMessageText(entry.failureReason),
    model: entry.model,
    promptVersion: entry.promptVersion,
    outputTokens: entry.outputTokens,
    contentDeletedAt: entry.contentDeletedAt,
    decisions: entry.decisions.map((item) => ({
      ...item,
      finalText: null,
      contentDeletedAt: null,
    })),
  };
}

const signalLabels: Record<string, string> = {
  sentiment: 'nastrój',
  overload: 'przeciążenie',
  engagement_drop: 'spadek zaangażowania',
  burnout_risk: 'ryzyko wypalenia',
};

const indexedLabels: Record<string, string> = {
  justification: 'Uzasadnienie',
  developmentConclusions: 'Wniosek rozwojowy',
  question: 'Pytanie',
  issue: 'Uwaga',
  warning: 'Ostrzeżenie',
  plan: 'Punkt planu',
  situation: 'Trudna sytuacja',
  moment: 'Moment',
  action: 'Działanie',
};

const fixedLabels: Record<string, string> = {
  rewrite: 'Wersja bez danych wrażliwych',
  goal: 'Cel rozmowy',
  answer: 'Odpowiedź',
};

const criterionPartLabels: Record<string, string> = {
  rating: 'ocena',
  justification: 'uzasadnienie',
};

/** A readable name of an output fragment path, the path itself for an unknown one. `criterionName`
 * turns a criterion id into its name. */
export function fragmentLabel(
  fragment: string,
  criterionName: (id: string) => string = (id) => id,
): string {
  const fixed = fixedLabels[fragment];
  if (fixed) return fixed;
  const parts = fragment.split('.');
  const [head = '', second = '', third] = parts;
  const index = /^\d+$/.test(second) ? Number(second) + 1 : null;

  if (head === 'criteria' && index !== null) {
    const part = third === undefined ? undefined : criterionPartLabels[third];
    return part ? `Kryterium ${index}, ${part}` : `Kryterium ${index}`;
  }
  if (parts.length === 2 && second !== '') {
    if (head === 'rating') return `Ocena, kryterium ${criterionName(second)}`;
    if (head === 'criterion') return `Dodatkowe kryterium ${criterionName(second)}`;
    if (head === 'expectations') return `Oczekiwane zachowania, kryterium ${criterionName(second)}`;
    if (head === 'signal') return `Sygnał, ${signalLabels[second] ?? second}`;
    const indexed = indexedLabels[head];
    if (indexed && index !== null) return `${indexed} ${index}`;
  }
  if (head === 'question' && parts.length === 3 && third !== undefined && /^\d+$/.test(third)) {
    return `Pytanie ${Number(third) + 1}, kryterium ${criterionName(second)}`;
  }
  return parts.join(' ');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filter of the log page from its query params, invalid values are skipped. */
export function parseAiLogFilter(params: SearchParams): {
  employeeId?: string;
  kind?: AiRunKind;
} {
  const employeeId = single(params.pracownik);
  const kind = single(params.rodzaj);
  return {
    ...(UUID.test(employeeId) ? { employeeId } : {}),
    ...(Object.hasOwn(aiKindLabels, kind) ? { kind: kind as AiRunKind } : {}),
  };
}
