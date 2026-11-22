import {
  type ArchivedEvaluation,
  type CalendarDate,
  type EvaluationView,
  type RegulationDocument,
} from '@sarmata/services';
import { type HeroStat } from '@sarmata/ui';
import { formatDate, formatScore } from '@/lib/format';
import { evaluationStatusLabels } from './labels';

export interface HistoryRow {
  key: string;
  period: string;
  source: string;
  mean: number | null;
  levelName: string | null;
  ratings: Record<string, number> | null;
  /** An evaluation in progress: the period is still running. */
  open: boolean;
  evaluationId: string | null;
  dateKey: string;
}

export interface CriteriaChange {
  columns: { key: string; period: string }[];
  rows: {
    criterionId: string;
    name: string;
    values: (number | null)[];
    change: { kind: 'up' | 'down' | 'same'; by: number } | null;
  }[];
}

export interface EmployeeHistory {
  rows: HistoryRow[];
  criteria: CriteriaChange;
  stats: HeroStat[];
}

interface HistoryInput {
  archived: readonly ArchivedEvaluation[];
  /** All evaluations of the employee, the interrupted ones are skipped. */
  views: readonly EvaluationView[];
  /** The regulation version in force today. */
  document: RegulationDocument;
  /** From the next step of the open evaluation. */
  current: { dueOn: CalendarDate | null; stage: string } | null;
}

const MINUS = '−';

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function archivedRow(item: ArchivedEvaluation, levelName: (code: string | null) => string | null) {
  const ratings =
    item.ratings !== null && Object.keys(item.ratings).length > 0 ? item.ratings : null;
  const row: HistoryRow = {
    key: `archived-${item.id}`,
    period: `Ocena ${item.draftedOn.slice(0, 4)}`,
    source: 'Archiwalna, wpisana ręcznie',
    mean: ratings ? mean(Object.values(ratings)) : null,
    levelName: levelName(item.levelCode),
    ratings,
    open: false,
    evaluationId: null,
    dateKey: item.draftedOn,
  };
  return row;
}

/** "Ocena 2024 do 2026" from the cycle start and the evaluation deadline, as in the case hero. */
function cyclePeriod(view: EvaluationView): string {
  const from = view.cycleStart.slice(0, 4);
  const due = view.deadlines.find((deadline) => deadline.slot === 'evaluationDeadline')?.dueOn;
  const to = due?.slice(0, 4);
  return !to || to === from ? `Ocena ${from}` : `Ocena ${from} do ${to}`;
}

function viewRow(view: EvaluationView, levelName: (code: string | null) => string | null) {
  const open = view.status !== 'closed';
  const approvedOn = view.events
    .filter((event) => event.kind === 'sheet_approved')
    .at(-1)?.occurredOn;
  const ratings = view.sheet.content.partTwo.ratings;
  const row: HistoryRow = {
    key: `evaluation-${view.id}`,
    period: cyclePeriod(view),
    source: open
      ? `W toku, ${evaluationStatusLabels[view.status]}`
      : approvedOn
        ? `Sporządzona w Sarmacie ${formatDate(approvedOn)}`
        : 'Sporządzona w Sarmacie',
    mean: open ? null : view.score.mean,
    levelName: open ? null : levelName(view.score.levelCode),
    ratings: open || Object.keys(ratings).length === 0 ? null : ratings,
    open,
    evaluationId: view.id,
    dateKey: view.cycleStart,
  };
  return row;
}

function criteriaChange(finished: readonly HistoryRow[], document: RegulationDocument) {
  const withRatings = finished.filter((row) => row.ratings !== null);
  const catalog = document.criteria.catalog;
  const ids: string[] = catalog.map((criterion) => criterion.id);
  for (const row of withRatings) {
    for (const id of Object.keys(row.ratings ?? {})) if (!ids.includes(id)) ids.push(id);
  }
  const used = ids.filter((id) => withRatings.some((row) => row.ratings?.[id] !== undefined));

  const result: CriteriaChange = {
    columns: withRatings.map((row) => ({ key: row.key, period: row.period })),
    rows: used.map((id) => {
      const values = withRatings.map((row) => row.ratings?.[id] ?? null);
      const known = values.filter((value): value is number => value !== null);
      const last = known.at(-1);
      const before = known.at(-2);
      let change: CriteriaChange['rows'][number]['change'] = null;
      if (last !== undefined && before !== undefined) {
        const diff = last - before;
        change = { kind: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same', by: Math.abs(diff) };
      }
      return {
        criterionId: id,
        name: catalog.find((criterion) => criterion.id === id)?.name ?? id,
        values,
        change,
      };
    }),
  };
  return result;
}

function statsOf(
  rows: readonly HistoryRow[],
  finished: readonly HistoryRow[],
  current: HistoryInput['current'],
): HeroStat[] {
  const stats: HeroStat[] = [];
  const last = finished.at(-1);
  if (last) {
    if (last.mean !== null) {
      stats.push({
        label: 'Ostatnia ocena',
        value: formatScore(last.mean),
        hint: last.levelName ? capitalize(last.levelName) : undefined,
      });
    } else {
      const short = last.levelName?.replace(/\s+oczekiwań$/, '');
      stats.push({
        label: 'Ostatnia ocena',
        value: short ? capitalize(short) : 'Brak',
        hint: 'Ocena archiwalna',
      });
    }
  } else {
    stats.push({
      label: 'Ostatnia ocena',
      value: 'Brak',
      hint: rows.length === 0 ? 'Pracownik nie ma jeszcze ocen' : 'Pierwsza ocena jest w toku',
    });
  }

  const means = finished.filter((row) => row.mean !== null);
  const first = means[0];
  const latest = means.at(-1);
  if (first && latest && means.length >= 2 && first.mean !== null && latest.mean !== null) {
    const diff = latest.mean - first.mean;
    const flat = Math.abs(diff) < 0.005;
    stats.push({
      label: `Zmiana od ${first.dateKey.slice(0, 4)}`,
      value: flat ? formatScore(0) : `${diff > 0 ? '+' : MINUS}${formatScore(Math.abs(diff))}`,
      hint: flat ? 'bez zmian' : `${diff > 0 ? 'wzrost' : 'spadek'} w ${means.length} ocenach`,
    });
  }

  if (current?.dueOn) {
    stats.push({
      label: 'Termin oceny',
      value: formatDate(current.dueOn).slice(0, 5),
      hint: `${current.dueOn.slice(0, 4)} r., ${current.stage}`,
    });
  }
  return stats;
}

/**
 * The evaluation record of one employee: archived and Sarmata evaluations oldest first, how every
 * criterion moved between the finished ones and the hero numbers. Level names come from the partial
 * scale of the regulation in force, criterion names from its catalog.
 */
export function employeeHistory(input: HistoryInput): EmployeeHistory {
  const { document } = input;
  const levelName = (code: string | null): string | null =>
    code === null
      ? null
      : (document.partialScale.levels.find((level) => level.code === code)?.name ?? null);

  const rows = [
    ...input.archived.map((item) => archivedRow(item, levelName)),
    ...input.views
      .filter((view) => view.status !== 'interrupted')
      .map((view) => viewRow(view, levelName)),
  ].sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const finished = rows.filter((row) => !row.open);
  return {
    rows,
    criteria: criteriaChange(finished, document),
    stats: statsOf(rows, finished, input.current),
  };
}
