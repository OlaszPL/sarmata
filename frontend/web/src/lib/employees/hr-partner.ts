import { type AiRun, type Note } from '@sarmata/services';
import { formatDate, todayInWarsaw } from '@/lib/format';
import { actionFrameworkLabels, hrSignalLabels } from './labels';

type HrSignalName = keyof typeof hrSignalLabels;
type HrRun = Extract<AiRun, { kind: 'hr_signals' }>;
type AppreciationRun = Extract<AiRun, { kind: 'appreciation_moments' }>;

export interface HrSignalsResult {
  runId: string;
  /** `dd.mm.rrrr` of `finishedAt` in Europe/Warsaw. */
  analysedOn: string;
  /** Only the present signals, the most probable first. */
  signals: {
    name: HrSignalName;
    label: string;
    probability: number;
    quotes: { quote: string; occurredOn: string | null }[];
    rejected: boolean;
  }[];
  /** Labels of the signals the analysis found absent. */
  absent: string[];
  questions: { fragment: string; text: string }[];
  actions: { fragment: string; framework: string; signal: string; text: string }[];
}

export type AiPanelState =
  | { kind: 'disabled' }
  | { kind: 'none' }
  | { kind: 'running'; since: string; previous: HrSignalsResult | null }
  | { kind: 'failed'; previous: HrSignalsResult | null }
  | { kind: 'done'; result: HrSignalsResult };

function analysisDate(run: { finishedAt: string | null; requestedAt: string }): string {
  return formatDate(todayInWarsaw(new Date(run.finishedAt ?? run.requestedAt)));
}

function resultOf(
  run: HrRun,
  notes: readonly Pick<Note, 'id' | 'occurredOn'>[],
): HrSignalsResult | null {
  const output = run.output;
  if (output === null) return null;
  const noteDate = new Map(notes.map((note) => [note.id, formatDate(note.occurredOn)]));
  // The last decision about a fragment wins.
  const decided = new Map(run.decisions.map((entry) => [entry.fragment, entry.decision]));

  return {
    runId: run.id,
    analysedOn: analysisDate(run),
    signals: output.signals
      .filter((signal) => signal.present)
      .sort((a, b) => b.probability - a.probability)
      .map((signal) => ({
        name: signal.signal,
        label: hrSignalLabels[signal.signal],
        probability: signal.probability,
        quotes: signal.fragments.map((fragment) => ({
          quote: fragment.quote,
          occurredOn: noteDate.get(fragment.noteId) ?? null,
        })),
        rejected: decided.get(`signal.${signal.signal}`) === 'rejected',
      })),
    absent: output.signals
      .filter((signal) => !signal.present)
      .map((signal) => hrSignalLabels[signal.signal]),
    questions: output.questions.map((text, index) => ({ fragment: `question.${index}`, text })),
    actions: output.actions.map((action, index) => ({
      fragment: `action.${index}`,
      framework: actionFrameworkLabels[action.framework],
      signal: hrSignalLabels[action.signal],
      text: action.text,
    })),
  };
}

/** `runs` come newest first (`ai.list`), `null` means the list did not load. */
export function hrPartnerModel(
  runs: readonly AiRun[] | null,
  aiEnabled: boolean,
  notes: readonly Pick<Note, 'id' | 'occurredOn'>[],
): AiPanelState {
  if (!aiEnabled) return { kind: 'disabled' };
  const hrRuns = (runs ?? []).filter((run): run is HrRun => run.kind === 'hr_signals');
  const latest = hrRuns[0];
  if (!latest) return { kind: 'none' };

  const previousDone = hrRuns.slice(1).find((run) => run.status === 'done');
  const previous = previousDone ? resultOf(previousDone, notes) : null;

  if (latest.status === 'queued' || latest.status === 'running') {
    return { kind: 'running', since: latest.startedAt ?? latest.requestedAt, previous };
  }
  if (latest.status === 'failed') return { kind: 'failed', previous };

  const result = resultOf(latest, notes);
  return result ? { kind: 'done', result } : { kind: 'none' };
}

export interface AppreciationModel {
  overdue: boolean;
  daysSince: number | null;
  thresholdDays: number;
  lastOn: string | null;
  moments: { reason: string; situation: string }[];
}

/** The latest done `appreciation_moments` run, null without one. */
export function appreciationModel(runs: readonly AiRun[] | null): AppreciationModel | null {
  const run = (runs ?? []).find(
    (candidate): candidate is AppreciationRun =>
      candidate.kind === 'appreciation_moments' &&
      candidate.status === 'done' &&
      candidate.output !== null,
  );
  const output = run?.output;
  if (!output) return null;
  return {
    overdue: output.gap.overdue,
    daysSince: output.gap.daysSince,
    thresholdDays: output.gap.thresholdDays,
    lastOn: output.gap.lastAppreciationOn ? formatDate(output.gap.lastAppreciationOn) : null,
    moments: output.moments.map((moment) => ({
      reason: moment.reason,
      situation: moment.sbi.situation,
    })),
  };
}
