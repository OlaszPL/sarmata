import { type CalendarDate } from '../deadlines/calendar-date';
import { type RegulationDocument } from '../regulations/regulation-document';
import { type TrainingChannel, type TrainingItem } from './training-catalog';

export type RecommendedTraining = TrainingItem & { priority: boolean };

export interface DevelopmentAction {
  kind: 'development-task' | 'substitution' | 'mentoring';
  /** Share of the 70-20-10 model: 70 on the job, 20 from others. The 10 is the trainings above. */
  share: 70 | 20;
  title: string;
  description: string;
}

export interface FocusCriterion {
  criterionId: string;
  name: string;
  points: number;
  trainings: RecommendedTraining[];
  actions: DevelopmentAction[];
}

export interface DevelopmentRecommendation {
  focus: FocusCriterion[];
  /** A short Polish draft of the conclusions of the sheet, for the evaluator to edit. */
  conclusionsDraft: string;
}

export interface RecommendInput {
  regulation: RegulationDocument;
  sheetId: string;
  ratings: Readonly<Record<string, number>>;
  catalog: readonly TrainingItem[];
  on: CalendarDate;
  perCriterion?: number;
}

const MAX_FOCUS = 3;
const DEFAULT_PER_CRITERION = 5;

const CHANNEL_RANK: Record<TrainingChannel, number> = {
  'sc-elearning': 0,
  'pdw-webinar': 1,
  'sc-trainers': 1,
  'central-training': 2,
  'government-platform': 2,
  ksap: 3,
  mooc: 4,
  mentoring: 5,
};

function actionsFor(name: string, mentoring: TrainingItem | undefined): DevelopmentAction[] {
  const program = mentoring
    ? ` W katalogu jest program: ${mentoring.title}${mentoring.url ? ` (${mentoring.url})` : ''}.`
    : '';
  return [
    {
      kind: 'development-task',
      share: 70,
      title: `Zadanie rozwojowe: ${name}`,
      description: `Przydziel zadanie, które wymaga kryterium "${name}", i omów z pracownikiem jego efekt po wykonaniu.`,
    },
    {
      kind: 'substitution',
      share: 70,
      title: `Zastępstwo lub rola w projekcie: ${name}`,
      description: `Powierz pracownikowi zastępstwo albo rolę w zespole, w której ćwiczy kryterium "${name}" w praktyce.`,
    },
    {
      kind: 'mentoring',
      share: 20,
      title: `Mentoring i informacja zwrotna: ${name}`,
      description: `Umów rozmowy z doświadczoną osobą z urzędu i regularną informację zwrotną w kryterium "${name}".${program}`,
    },
  ];
}

function conclusions(focus: readonly FocusCriterion[]): string {
  if (focus.length === 0) {
    return 'Wszystkie kryteria oceniono na najwyższym poziomie. Nie ma obszarów, które wymagają rozwoju w kolejnym okresie oceniania.';
  }
  const areas = focus.map((item) => `${item.name} (${item.points} pkt)`).join(', ');
  const proposals = focus
    .map((item) => {
      const first = item.trainings[0];
      return first
        ? `W kryterium "${item.name}" proponuję: ${first.title}.`
        : `W kryterium "${item.name}" proponuję zadanie rozwojowe i mentoring.`;
    })
    .join(' ');
  return `W kolejnym okresie oceniania warto rozwijać: ${areas}. ${proposals} Szczegóły do ustalenia z pracownikiem w indywidualnym planie rozwoju zawodowego.`;
}

/**
 * Development suggestions for a sheet: up to three criteria rated below the top level, each with
 * catalog trainings (free first, then SSC priorities) and 70-20-10 actions. A suggestion only, the
 * evaluator decides.
 */
export function recommendDevelopment(input: RecommendInput): DevelopmentRecommendation {
  const { regulation, sheetId, ratings, catalog, on } = input;
  const sheet = regulation.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw new RangeError(`Unknown sheet ${sheetId}`);
  const isManager = sheet.positionKind === 'office-head' || sheet.positionKind === 'manages-people';
  const top = Math.max(...regulation.partialScale.levels.map((level) => level.points));
  const year = Number(on.slice(0, 4));
  const perCriterion = input.perCriterion ?? DEFAULT_PER_CRITERION;
  const mentoring = catalog.find((item) => item.channel === 'mentoring');

  const focus = regulation.criteria.catalog
    .map((criterion, order) => ({ criterion, order, points: ratings[criterion.id] }))
    .filter(
      (entry): entry is typeof entry & { points: number } =>
        entry.points !== undefined && entry.points < top,
    )
    .sort((a, b) => a.points - b.points || a.order - b.order)
    .slice(0, MAX_FOCUS)
    .map(({ criterion, points }): FocusCriterion => {
      const trainings = catalog
        .filter(
          (item) =>
            item.criteria.includes(criterion.id) &&
            item.status !== 'finished' &&
            (item.audience === 'all' || (isManager && item.audience === 'managers')),
        )
        .map((item): RecommendedTraining => ({
          ...item,
          priority: item.priorityYears.includes(year),
        }))
        .sort(
          (a, b) =>
            Number(b.free) - Number(a.free) ||
            Number(b.priority) - Number(a.priority) ||
            CHANNEL_RANK[a.channel] - CHANNEL_RANK[b.channel] ||
            Number(b.mainCriterion === criterion.id) - Number(a.mainCriterion === criterion.id) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, perCriterion);
      return {
        criterionId: criterion.id,
        name: criterion.name,
        points,
        trainings,
        actions: actionsFor(criterion.name, mentoring),
      };
    });
  return { focus, conclusionsDraft: conclusions(focus) };
}
