import {
  type CalendarDate,
  type EvaluationStatus,
  type HistoryEntry,
  type RegulationDocument,
  type SheetContent,
  type ServiceStatus,
  calendarDate,
  emptySheetContent,
  scoreSheet,
  sheetCriteria,
} from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { type EvaluationEvent, type SheetVersion } from '@sarmata/repositories';
import { type EvaluationView } from '@sarmata/services';
import { type ExportSource } from './sheet-document';

const [regulation] = officialRegulations;
if (regulation === undefined) throw new Error('The official regulation catalog is empty');
export const regulation2016: RegulationDocument = regulation;

export const EVALUATOR_ACCOUNT = '00000000-0000-4000-8000-0000000000e1';
export const HR_ACCOUNT = '00000000-0000-4000-8000-0000000000a2';
export const EVALUATED_ACCOUNT = '00000000-0000-4000-8000-0000000000b3';

const d = (iso: string): CalendarDate => calendarDate(iso);

export interface EventSpec {
  readonly id?: string;
  readonly kind: EvaluationEvent['kind'];
  readonly occurredOn: string;
  readonly recordedAt?: string;
  readonly recordedBy?: string;
  readonly payload?: Record<string, unknown>;
}

let eventCounter = 0;

export function event(spec: EventSpec): EvaluationEvent {
  eventCounter += 1;
  return {
    id: spec.id ?? `00000000-0000-4000-8000-${String(eventCounter).padStart(12, '0')}`,
    kind: spec.kind,
    occurredOn: d(spec.occurredOn),
    payload: spec.payload ?? {},
    recordedBy: spec.recordedBy ?? EVALUATOR_ACCOUNT,
    recordedAt: spec.recordedAt ?? `${spec.occurredOn}T09:30:00.000Z`,
  };
}

/** An approval event: the payload carries the version and the stored hash, like the database writes it. */
export function approval(
  kind: EvaluationEvent['kind'],
  version: number,
  occurredOn: string,
  extra: Record<string, unknown> = {},
  by: string = EVALUATOR_ACCOUNT,
): EvaluationEvent {
  return event({
    kind,
    occurredOn,
    recordedBy: by,
    payload: {
      sheetVersion: version,
      sheetSha256: String(version).repeat(64).slice(0, 64),
      ...extra,
    },
  });
}

export interface SourceSpec {
  readonly sheetId?: 'A' | 'B' | 'C';
  readonly points?: readonly number[];
  readonly additional?: readonly string[];
  readonly state?: SheetVersion['state'];
  readonly status?: EvaluationStatus;
  readonly serviceStatus?: ServiceStatus;
  readonly gradeRequest?: SheetContent['partTwo']['gradeRequest'];
  readonly justification?: string;
  readonly events?: readonly EvaluationEvent[];
  readonly versions?: readonly SheetVersion[];
  readonly history?: readonly HistoryEntry[];
  readonly officeName?: string;
  readonly objectionAddressee?: string | null;
  readonly evaluator?: ExportSource['evaluator'];
  readonly currentVersion?: number;
}

const DEFAULT_POINTS = [5, 5, 5, 5, 5];

export function sheetContent(spec: SourceSpec = {}): SheetContent {
  const sheetId = spec.sheetId ?? 'C';
  const content = emptySheetContent();
  content.partOne.additionalCriteria = [...(spec.additional ?? [])];
  content.partOne.dueOn = d('2026-06-15');
  const criteria = sheetCriteria(regulation2016, sheetId, content.partOne.additionalCriteria);
  const points = spec.points ?? DEFAULT_POINTS;
  criteria.forEach((id, index) => {
    const given = points[index];
    if (given !== undefined) content.partTwo.ratings[id] = given;
  });
  content.partTwo.interviewOn = d('2026-06-10');
  content.partTwo.periodFrom = d('2025-06-12');
  content.partTwo.periodTo = d('2026-06-15');
  content.partTwo.justification = spec.justification ?? '';
  content.partTwo.developmentConclusions = 'Szkolenie z zarządzania projektami.';
  content.partTwo.gradeRequest = spec.gradeRequest ?? null;
  return content;
}

/** A complete export source: Kowalska Zofia evaluated by Jan Nowak in an office with an ampersand. */
export function makeSource(spec: SourceSpec = {}): ExportSource {
  const sheetId = spec.sheetId ?? 'C';
  const content = sheetContent(spec);
  const criteria = sheetCriteria(regulation2016, sheetId, content.partOne.additionalCriteria);
  const score = scoreSheet(regulation2016, criteria, content.partTwo.ratings);
  const version = spec.currentVersion ?? 1;
  const view: EvaluationView = {
    id: '00000000-0000-4000-8000-00000000f001',
    officeId: '11111111-1111-4111-8111-111111111111',
    employeeId: '00000000-0000-4000-8000-00000000c001',
    evaluatorAccountId: EVALUATOR_ACCOUNT,
    regulationId: regulation2016.id,
    sheetId,
    status: spec.status ?? 'delivered',
    cycleStart: d('2025-06-12'),
    afterNegative: false,
    previousEvaluationId: null,
    snapshot: {
      firstName: 'Zofia',
      lastName: 'Kowalska',
      positionTitle: 'główny specjalista',
      orgUnit: 'Wydział Analiz',
      serviceStatus: spec.serviceStatus ?? 'civil_servant',
      grade: 5,
      appointmentYear: 2019,
      gradeGrantedOn: d('2022-03-01'),
    },
    createdAt: '2025-06-12T08:00:00.000Z',
    sheet: { version, state: spec.state ?? 'locked', content },
    events: [...(spec.events ?? [])],
    deadlines: [],
    criteria,
    score,
    currentPosition: { positionTitle: 'główny specjalista', orgUnit: 'Wydział Analiz' },
    objectionAddressee:
      spec.objectionAddressee === undefined
        ? (regulation2016.sheets.find((sheet) => sheet.id === sheetId)?.objectionAddressee ?? null)
        : spec.objectionAddressee,
    signals: { gradeByLaw: null, secondConsecutiveNegative: false },
  };
  return {
    view,
    regulation: regulation2016,
    officeName: spec.officeName ?? 'Urząd Testów i Badań',
    evaluator:
      spec.evaluator === undefined
        ? {
            firstName: 'Jan',
            lastName: 'Nowak',
            positionTitle: 'dyrektor departamentu',
            orgUnit: 'Departament Oceny',
          }
        : spec.evaluator,
    accountNames: new Map([
      [EVALUATOR_ACCOUNT, 'Jan Nowak'],
      [HR_ACCOUNT, 'Karolina Kadrowa'],
    ]),
    history: spec.history ?? [],
    sheetVersions: spec.versions ?? [
      {
        version,
        state: spec.state ?? 'locked',
        content,
        reason: null,
        createdBy: EVALUATOR_ACCOUNT,
        createdAt: '2025-06-12T08:00:00.000Z',
      },
    ],
  };
}
