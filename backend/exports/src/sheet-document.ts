import {
  type CalendarDate,
  type HistoryEntry,
  type RegulationDocument,
  type SheetContent,
  type SheetScore,
  scoreSheet,
  sheetCriteria,
  termChangePayloadSchema,
} from '@sarmata/domain';
import { type EvaluationEvent, type SheetVersion } from '@sarmata/repositories';
import { type EvaluationView } from '@sarmata/services';
import { ExportError } from './errors';
import { pointsWord } from './format';
import {
  type FootnoteKey,
  type FormLabels,
  type NoticeLabels,
  regulationTexts,
} from './regulation-2016-text';

export interface PersonOnSheet {
  readonly firstName: string;
  readonly lastName: string;
  readonly positionTitle: string | null;
  readonly orgUnit: string | null;
}

/** Everything the exports read, loaded once (see `loadExportSource`). */
export interface ExportSource {
  readonly view: EvaluationView;
  readonly regulation: RegulationDocument;
  readonly officeName: string;
  /** The evaluator as an employee, `null` when the account has no employee record. */
  readonly evaluator: PersonOnSheet | null;
  /** Account id to the name of the person, for the approvals. */
  readonly accountNames: ReadonlyMap<string, string>;
  readonly history: readonly HistoryEntry[];
  readonly sheetVersions: readonly SheetVersion[];
}

export interface PersonLine {
  readonly firstName: string;
  readonly lastName: string;
  readonly orgUnit: string;
  readonly positionTitle: string;
}

export interface Approval {
  readonly eventId: string;
  readonly kind: EvaluationEvent['kind'];
  readonly label: string;
  readonly occurredOn: CalendarDate;
  readonly recordedAt: string;
  /** Name of the person, or the account id when the name is unknown. */
  readonly recordedBy: string;
  readonly sheetVersion: number;
  readonly sheetSha256: string;
  readonly place: string | null;
  readonly refusalNote: string | null;
  readonly witnesses: string[];
}

export interface PlaceAndDate {
  readonly place: string | null;
  readonly occurredOn: CalendarDate;
}

export interface ScaleColumn {
  readonly code: string;
  readonly name: string;
  readonly points: number;
}

export interface CriterionRow {
  readonly id: string;
  readonly name: string;
  readonly additional: boolean;
  /** Points given, `null` when the criterion is not rated yet. */
  readonly points: number | null;
  /** The scale column that gets the X, `null` without a rating. */
  readonly markedCode: string | null;
}

export interface BandRow {
  readonly code: string;
  readonly name: string;
  readonly range: string;
  readonly marked: boolean;
}

export interface TermNotice {
  readonly eventId: string;
  readonly noticeOn: CalendarDate;
  readonly newDueOn: CalendarDate;
  readonly reason: string;
  readonly reasonLabel: string;
}

export interface SheetDocument {
  readonly sheetId: string;
  readonly title: string;
  readonly isDraft: boolean;
  readonly version: {
    readonly number: number;
    readonly state: SheetVersion['state'];
    readonly reason: string | null;
  };
  readonly officeName: string;
  readonly labels: FormLabels;
  readonly partOne: {
    readonly evaluated: PersonLine;
    readonly evaluator: PersonLine;
    readonly orgUnitFields: boolean;
    readonly mandatoryCriteria: string[];
    readonly additionalCriteria: string[];
    readonly dueOn: CalendarDate | null;
  };
  readonly partTwo: {
    readonly interviewOn: CalendarDate | null;
    readonly periodFrom: CalendarDate | null;
    readonly periodTo: CalendarDate | null;
    readonly scale: ScaleColumn[];
    readonly criteria: CriterionRow[];
    readonly mean: number | null;
    readonly bands: BandRow[];
    readonly levelCode: string | null;
    readonly outcome: 'positive' | 'negative' | null;
    readonly justification: string;
    readonly justificationRequired: boolean;
    readonly developmentConclusions: string;
    readonly previous: {
      readonly outcomeLabel: string | null;
      readonly levelName: string | null;
      readonly draftedOn: CalendarDate;
    } | null;
    readonly gradeRequestAnswer: 'yes' | 'no' | 'not_applicable';
    readonly objectionNotice: string;
  };
  /** `null` for an employee (not a civil servant) and when no grade request is attached. */
  readonly partThree: {
    readonly firstName: string;
    readonly lastName: string;
    readonly appointmentYear: number | null;
    readonly currentGrade: number | null;
    readonly gradeGrantedOn: CalendarDate | null;
    readonly requestedGrade: number;
    readonly motivation: string;
    readonly evaluator: PersonLine;
  } | null;
  readonly approvals: Approval[];
  /** Place and date printed next to the signature lines, taken from the approvals of this version. */
  readonly placeAndDate: {
    readonly partOneEvaluator: PlaceAndDate | null;
    readonly partOneEvaluated: PlaceAndDate | null;
    readonly partTwoEvaluator: PlaceAndDate | null;
    readonly partTwoEvaluated: PlaceAndDate | null;
  };
  readonly attachments: TermNotice[];
  readonly signatureBox: boolean;
  readonly footnotes: Partial<Record<FootnoteKey, string>>;
}

/** The newest entry drafted on or before the start of the cycle, or `null`. */
export function previousEvaluation(
  history: readonly HistoryEntry[],
  cycleStart: CalendarDate,
): HistoryEntry | null {
  const earlier = history
    .filter((entry) => entry.drafted <= cycleStart)
    .sort((a, b) => a.drafted.localeCompare(b.drafted));
  return earlier.at(-1) ?? null;
}

export function textsFor(regulation: RegulationDocument) {
  const texts = regulationTexts[regulation.id];
  if (texts === undefined) {
    throw new ExportError(
      'unsupported_regulation',
      `No form texts for regulation ${regulation.id}`,
    );
  }
  return texts;
}

export function noticeLabelsFor(regulation: RegulationDocument): NoticeLabels {
  return textsFor(regulation).notice;
}

const personLine = (person: PersonOnSheet | null): PersonLine => ({
  firstName: person?.firstName ?? '',
  lastName: person?.lastName ?? '',
  orgUnit: person?.orgUnit ?? '',
  positionTitle: person?.positionTitle ?? '',
});

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

function toApproval(
  event: EvaluationEvent,
  version: number,
  names: ReadonlyMap<string, string>,
  labels: Record<string, string>,
): Approval | null {
  const { sheetVersion, sheetSha256 } = event.payload;
  if (sheetVersion !== version || typeof sheetSha256 !== 'string') return null;
  const witnesses = Array.isArray(event.payload.witnesses)
    ? event.payload.witnesses.filter((name): name is string => typeof name === 'string')
    : [];
  return {
    eventId: event.id,
    kind: event.kind,
    label: labels[event.kind] ?? event.kind,
    occurredOn: event.occurredOn,
    recordedAt: event.recordedAt,
    recordedBy: names.get(event.recordedBy) ?? event.recordedBy,
    sheetVersion: version,
    sheetSha256,
    place: stringOrNull(event.payload.place),
    refusalNote: stringOrNull(event.payload.refusalNote),
    witnesses,
  };
}

/** Scores valid ratings only, like the service: drafts may hold off-scale ones. */
function scoreContent(
  regulation: RegulationDocument,
  sheetId: string,
  content: SheetContent,
): { criteria: string[]; score: SheetScore } {
  const criteria = sheetCriteria(regulation, sheetId, content.partOne.additionalCriteria);
  const allowed = new Set(regulation.partialScale.levels.map((level) => level.points));
  const ratings = Object.fromEntries(
    Object.entries(content.partTwo.ratings).filter(([, points]) => allowed.has(points)),
  );
  return { criteria, score: scoreSheet(regulation, criteria, ratings) };
}

function bandRows(regulation: RegulationDocument, levelCode: string | null): BandRow[] {
  const names = new Map(regulation.partialScale.levels.map((level) => [level.code, level.name]));
  return regulation.overallLevel.bands.map((band, index) => ({
    code: band.code,
    name: names.get(band.code) ?? band.code,
    range:
      index === 0
        ? `od ${String(band.min)} ${pointsWord(band.min)} do ${String(band.max)} ${pointsWord(band.max)}`
        : `powyżej ${String(band.min)} ${pointsWord(band.min)} do ${String(band.max)} ${pointsWord(band.max)}`,
    marked: band.code === levelCode,
  }));
}

/**
 * The model of one sheet version, read by the PDF and DOCX adapters. All form logic lives here:
 * criteria names, the X marks, the overall band, footnotes and approvals.
 */
export function buildSheetDocument(
  source: ExportSource,
  options: { version?: number; signatureBox: boolean },
): SheetDocument {
  const { view, regulation } = source;
  const texts = textsFor(regulation);
  const sheet = regulation.sheets.find((candidate) => candidate.id === view.sheetId);
  if (sheet === undefined) {
    throw new ExportError('unsupported_regulation', `Unknown sheet ${view.sheetId}`);
  }
  const versionNumber = options.version ?? view.sheet.version;
  const stored = source.sheetVersions.find((candidate) => candidate.version === versionNumber);
  const current =
    versionNumber === view.sheet.version
      ? { state: view.sheet.state, content: view.sheet.content, reason: stored?.reason ?? null }
      : stored;
  if (current === undefined) {
    throw new ExportError('not_found', `Sheet version ${String(versionNumber)} does not exist`);
  }
  const { content } = current;
  const { criteria, score } = scoreContent(regulation, view.sheetId, content);
  const catalog = new Map(
    regulation.criteria.catalog.map((criterion) => [criterion.id, criterion]),
  );
  const nameOf = (id: string) => catalog.get(id)?.name ?? id;
  const scale = regulation.partialScale.levels.map((level) => ({
    code: level.code,
    name: level.name,
    points: level.points,
  }));
  const codeOfPoints = new Map(scale.map((column) => [column.points, column.code]));
  const rows: CriterionRow[] = criteria.map((id) => {
    const points = content.partTwo.ratings[id];
    return {
      id,
      name: nameOf(id),
      additional: !sheet.mandatoryCriteria.includes(id),
      points: points ?? null,
      markedCode: points === undefined ? null : (codeOfPoints.get(points) ?? null),
    };
  });

  const approvals = view.events
    .map((event) => toApproval(event, versionNumber, source.accountNames, texts.eventLabels))
    .filter((approval): approval is Approval => approval !== null);
  const firstOf = (...kinds: string[]): PlaceAndDate | null => {
    const found = approvals.find((approval) => kinds.includes(approval.kind));
    return found === undefined ? null : { place: found.place, occurredOn: found.occurredOn };
  };

  const isCivilServant = view.snapshot.serviceStatus === 'civil_servant';
  const gradeRequest = content.partTwo.gradeRequest;
  const evaluator = personLine(source.evaluator);
  const previous = previousEvaluation(source.history, view.cycleStart);
  const levelNames = new Map(scale.map((column) => [column.code, column.name]));

  return {
    sheetId: view.sheetId,
    title: texts.sheetTitle(view.sheetId),
    isDraft: current.state === 'draft',
    version: { number: versionNumber, state: current.state, reason: current.reason },
    officeName: source.officeName,
    labels: texts.labels,
    partOne: {
      evaluated: {
        firstName: view.snapshot.firstName,
        lastName: view.snapshot.lastName,
        orgUnit: view.currentPosition.orgUnit ?? '',
        positionTitle: view.currentPosition.positionTitle ?? '',
      },
      evaluator,
      orgUnitFields: sheet.orgUnitFields,
      mandatoryCriteria: sheet.mandatoryCriteria.map(nameOf),
      additionalCriteria: content.partOne.additionalCriteria.map(nameOf),
      dueOn: content.partOne.dueOn,
    },
    partTwo: {
      interviewOn: content.partTwo.interviewOn,
      periodFrom: content.partTwo.periodFrom,
      periodTo: content.partTwo.periodTo,
      scale,
      criteria: rows,
      mean: score.mean,
      bands: bandRows(regulation, score.levelCode),
      levelCode: score.levelCode,
      outcome: score.outcome,
      justification: content.partTwo.justification,
      justificationRequired:
        score.outcome === 'negative' && regulation.justification.requiredForNegative,
      developmentConclusions: content.partTwo.developmentConclusions,
      previous:
        previous === null
          ? null
          : {
              outcomeLabel:
                previous.outcome === null
                  ? null
                  : previous.outcome === 'positive'
                    ? 'pozytywna'
                    : 'negatywna',
              levelName:
                previous.levelCode === null ? null : (levelNames.get(previous.levelCode) ?? null),
              draftedOn: previous.drafted,
            },
      gradeRequestAnswer: !isCivilServant ? 'not_applicable' : gradeRequest === null ? 'no' : 'yes',
      objectionNotice: texts.objectionNotice(view.sheetId, view.objectionAddressee),
    },
    partThree:
      isCivilServant && gradeRequest !== null
        ? {
            firstName: view.snapshot.firstName,
            lastName: view.snapshot.lastName,
            appointmentYear: view.snapshot.appointmentYear,
            currentGrade: view.snapshot.grade,
            gradeGrantedOn: view.snapshot.gradeGrantedOn,
            requestedGrade: gradeRequest.requestedGrade,
            motivation: gradeRequest.motivation,
            evaluator,
          }
        : null,
    approvals,
    placeAndDate: {
      partOneEvaluator: firstOf('part_one_approved'),
      partOneEvaluated: firstOf('part_one_signed'),
      partTwoEvaluator: firstOf('sheet_approved'),
      partTwoEvaluated: firstOf('acquainted', 'signature_refused'),
    },
    attachments: termNotices(source),
    signatureBox: options.signatureBox,
    footnotes: texts.footnotes(view.sheetId),
  };
}

/** The `term_changed` events of the evaluation with a readable payload, oldest first. */
export function termNotices(source: ExportSource): TermNotice[] {
  const texts = textsFor(source.regulation);
  return source.view.events.flatMap((event) => {
    if (event.kind !== 'term_changed') return [];
    const parsed = termChangePayloadSchema.safeParse(event.payload);
    if (!parsed.success) return [];
    return [
      {
        eventId: event.id,
        noticeOn: parsed.data.noticeOn,
        newDueOn: parsed.data.newDueOn,
        reason: parsed.data.reason,
        reasonLabel: texts.termReasons[parsed.data.reason],
      },
    ];
  });
}
