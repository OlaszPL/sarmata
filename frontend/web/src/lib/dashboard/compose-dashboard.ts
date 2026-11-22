import { type AiRun, type CalendarDate, type EvaluationView } from '@sarmata/services';
import { daysUntil, pluralPl } from '../format';
import { type NextStep, nextStep } from '../evaluations/next-step';

export interface DashboardSources {
  /** Evaluations in progress led by the account. */
  readonly views: readonly EvaluationView[];
  /** Closed evaluations led by the account, with their event log. */
  readonly closed: readonly EvaluationView[];
  readonly aiEnabled: boolean;
  /** Null when the fetch failed. */
  readonly hrRuns: readonly AiRun[] | null;
  readonly appreciationRuns: readonly AiRun[] | null;
  readonly draftRuns: readonly AiRun[] | null;
}

export interface DashboardRow {
  readonly evaluationId: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly sheetId: string;
  readonly step: NextStep;
  readonly daysLeft: number | null;
}

export interface SignalSummary {
  readonly label: string;
  readonly probability: number;
  readonly quote: string | null;
}

export interface DashboardData {
  readonly today: CalendarDate;
  readonly headline: string;
  /** At most three rows owned by the evaluator. */
  readonly todo: readonly DashboardRow[];
  readonly others: readonly DashboardRow[];
  readonly summary: {
    readonly todo: number;
    readonly overdue: number;
    /** Drawn up and waiting for the employee to acknowledge them (status `drafted`). */
    readonly awaitingEmployee: number;
    /** Closed in the calendar year of `today`, by the date of the closing event. */
    readonly closedThisYear: number;
    readonly nearestDueOn: CalendarDate | null;
  };
  readonly aiEnabled: boolean;
  readonly hrSignal: {
    readonly employeeId: string;
    readonly employeeName: string;
    readonly signal: SignalSummary;
  } | null;
  readonly appreciation: {
    readonly employeeId: string;
    readonly employeeName: string;
    readonly reason: string;
    readonly daysSince: number | null;
  } | null;
  readonly runningDrafts: readonly {
    readonly runId: string;
    readonly employeeName: string;
    readonly partialText: string | null;
  }[];
}

const TODO_LIMIT = 3;

const SIGNAL_LABELS = {
  overload: 'Możliwe przeciążenie',
  burnout_risk: 'Ryzyko wypalenia',
  engagement_drop: 'Spadek zaangażowania',
  sentiment: 'Negatywny wydźwięk notatek',
} as const;

const DEFAULT_APPRECIATION_REASON = 'Od dawna brak notatki z docenieniem';

/**
 * A draft requested longer ago than this is treated as stuck (no worker, or the worker died), so
 * the panel and its polling stop instead of waiting forever.
 */
const DRAFT_STALE_MS = 30 * 60 * 1000;

function toRow(view: EvaluationView, today: CalendarDate): DashboardRow | null {
  const step = nextStep(view);
  if (!step) return null;
  return {
    evaluationId: view.id,
    employeeId: view.employeeId,
    employeeName: `${view.snapshot.firstName} ${view.snapshot.lastName}`,
    sheetId: view.sheetId,
    step,
    daysLeft: step.dueOn ? daysUntil(today, step.dueOn) : null,
  };
}

/** Evaluator rows first, then by days left ascending with undated rows last. */
function compareRows(a: DashboardRow, b: DashboardRow): number {
  const ownerRank = Number(a.step.owner !== 'evaluator') - Number(b.step.owner !== 'evaluator');
  if (ownerRank !== 0) return ownerRank;
  if (a.daysLeft === b.daysLeft) return 0;
  if (a.daysLeft === null) return 1;
  if (b.daysLeft === null) return -1;
  return a.daysLeft - b.daysLeft;
}

/** Date of the newest closing event in the log, null when the log has none. */
function closedOn(view: EvaluationView): CalendarDate | null {
  return view.events.filter((event) => event.kind === 'closed').at(-1)?.occurredOn ?? null;
}

/** `Arkusz C, część II`, for an unfinished part II with `, brakuje 2 pól`. */
export function todoMeta(row: Pick<DashboardRow, 'sheetId' | 'step'>): string {
  const { stage, missingFields } = row.step;
  const meta = `Arkusz ${row.sheetId}, ${stage.charAt(0).toLowerCase()}${stage.slice(1)}`;
  if (!missingFields) return meta;
  return `${meta}, brakuje ${missingFields} ${pluralPl(missingFields, 'pola', 'pól', 'pól')}`;
}

function headlineFor(todoCount: number): string {
  if (todoCount === 0) return 'Nie masz spraw do zrobienia.';
  return `Masz ${todoCount} ${pluralPl(todoCount, 'sprawę', 'sprawy', 'spraw')} do zrobienia.`;
}

type DoneRun<K extends AiRun['kind']> = Extract<AiRun, { kind: K }> & {
  output: NonNullable<Extract<AiRun, { kind: K }>['output']>;
};

function isDoneRunOf<K extends AiRun['kind']>(run: AiRun, kind: K): run is DoneRun<K> {
  return run.kind === kind && run.status === 'done' && run.output !== null;
}

/** The newest done run of each employee in `names`, for one kind. */
function latestDoneByEmployee<K extends AiRun['kind']>(
  runs: readonly AiRun[] | null,
  kind: K,
  names: ReadonlyMap<string, string>,
): { employeeId: string; run: DoneRun<K> }[] {
  const newest = new Map<string, DoneRun<K>>();
  for (const run of runs ?? []) {
    if (!isDoneRunOf(run, kind) || !run.employeeId) continue;
    if (!names.has(run.employeeId)) continue;
    const current = newest.get(run.employeeId);
    if (!current || (run.finishedAt ?? '') > (current.finishedAt ?? '')) {
      newest.set(run.employeeId, run);
    }
  }
  return [...newest].map(([employeeId, run]) => ({ employeeId, run }));
}

function pickHrSignal(
  runs: readonly AiRun[] | null,
  names: ReadonlyMap<string, string>,
): DashboardData['hrSignal'] {
  let best: NonNullable<DashboardData['hrSignal']> | null = null;
  for (const { employeeId, run } of latestDoneByEmployee(runs, 'hr_signals', names)) {
    for (const signal of run.output.signals) {
      if (!signal.present) continue;
      if (best && signal.probability <= best.signal.probability) continue;
      best = {
        employeeId,
        employeeName: names.get(employeeId) ?? '',
        signal: {
          label: SIGNAL_LABELS[signal.signal],
          probability: signal.probability,
          quote: signal.fragments[0]?.quote ?? null,
        },
      };
    }
  }
  return best;
}

function pickAppreciation(
  runs: readonly AiRun[] | null,
  names: ReadonlyMap<string, string>,
): DashboardData['appreciation'] {
  for (const { employeeId, run } of latestDoneByEmployee(runs, 'appreciation_moments', names)) {
    const { gap, moments } = run.output;
    if (!gap.overdue && moments.length === 0) continue;
    return {
      employeeId,
      employeeName: names.get(employeeId) ?? '',
      reason: moments[0]?.reason ?? DEFAULT_APPRECIATION_REASON,
      daysSince: gap.daysSince,
    };
  }
  return null;
}

function pickRunningDrafts(
  runs: readonly AiRun[] | null,
  names: ReadonlyMap<string, string>,
  now: Date,
): DashboardData['runningDrafts'] {
  return (runs ?? []).flatMap((run) => {
    if (run.kind !== 'sheet_draft') return [];
    if (run.status !== 'queued' && run.status !== 'running') return [];
    const requestedAt = Date.parse(run.requestedAt);
    if (!(now.getTime() - requestedAt <= DRAFT_STALE_MS)) return [];
    const employeeName = run.employeeId ? names.get(run.employeeId) : undefined;
    if (employeeName === undefined) return [];
    return [{ runId: run.id, employeeName, partialText: run.partialText }];
  });
}

/**
 * Everything the dashboard shows, computed from fetched data so the page stays a thin view.
 * `today` is the calendar day in Warsaw, `now` the instant used to drop stuck AI drafts.
 */
export function composeDashboard(
  sources: DashboardSources,
  today: CalendarDate,
  now: Date = new Date(),
): DashboardData {
  const rows = sources.views
    .map((view) => toRow(view, today))
    .filter((row): row is DashboardRow => row !== null)
    .sort(compareRows);

  const mine = rows.filter((row) => row.step.owner === 'evaluator');
  const nearestDueOn = mine.reduce<CalendarDate | null>((nearest, row) => {
    const due = row.step.dueOn;
    return due && (!nearest || due < nearest) ? due : nearest;
  }, null);

  const names = new Map(
    sources.views.map((view) => [
      view.employeeId,
      `${view.snapshot.firstName} ${view.snapshot.lastName}`,
    ]),
  );
  const ai = sources.aiEnabled;
  const year = today.slice(0, 4);

  return {
    today,
    headline: headlineFor(mine.length),
    todo: rows.slice(0, Math.min(TODO_LIMIT, mine.length)),
    others: rows.slice(Math.min(TODO_LIMIT, mine.length)),
    summary: {
      todo: mine.length,
      // Only the evaluator's own late steps: HR and the closing job are not the evaluator's to chase.
      overdue: mine.filter((row) => row.daysLeft !== null && row.daysLeft < 0).length,
      awaitingEmployee: sources.views.filter((view) => view.status === 'drafted').length,
      closedThisYear: sources.closed.filter((view) => closedOn(view)?.slice(0, 4) === year).length,
      nearestDueOn,
    },
    aiEnabled: ai,
    hrSignal: ai ? pickHrSignal(sources.hrRuns, names) : null,
    appreciation: ai ? pickAppreciation(sources.appreciationRuns, names) : null,
    runningDrafts: ai ? pickRunningDrafts(sources.draftRuns, names, now) : [],
  };
}
