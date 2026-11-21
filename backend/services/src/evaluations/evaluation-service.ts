import {
  type ApprovalIssue,
  type CalendarDate,
  type EvaluationCommand,
  type EvaluationStatus,
  type RegulationDocument,
  type SheetContent,
  type SheetScore,
  TransitionError,
  emptySheetContent,
  evaluationEligibility,
  partOneIssues,
  planTransition,
  proposeSheet,
  scoreSheet,
  sheetApprovalIssues,
  sheetContentSchema,
  sheetCriteria,
} from '@sarmata/domain';
import {
  type Evaluation,
  type EvaluationDetail,
  type EvaluationEventKind,
  type Repositories,
  RepositoryError,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';
import { sameJson } from '../same-json';
import { computeEvaluationDeadlines } from './deadlines';

export interface StartEvaluationInput {
  readonly employeeId: string;
  /** Defaults to the supervisor's account, then to the signed-in account. */
  readonly evaluatorAccountId?: string;
  /** Defaults to the sheet proposed for the position kind. */
  readonly sheetId?: string;
  readonly today: CalendarDate;
  /**
   * Start of the evaluation cycle. Defaults to the approval date of the previous evaluation,
   * otherwise to `today` (history starts when the system is deployed).
   */
  readonly cycleStart?: CalendarDate;
}

/** An evaluation with the criteria to rate and the computed result, ready for the frontend. */
export type EvaluationView = EvaluationDetail & {
  readonly criteria: string[];
  readonly score: SheetScore;
};

export interface EvaluationFilter {
  readonly status?: EvaluationStatus;
  readonly evaluatorAccountId?: string;
  readonly employeeId?: string;
}

export interface EvaluationService {
  start(input: StartEvaluationInput): Promise<EvaluationView>;
  get(id: string): Promise<EvaluationView | null>;
  list(filter?: EvaluationFilter): Promise<Evaluation[]>;
  saveDraft(id: string, content: SheetContent): Promise<EvaluationView>;
  transition(id: string, command: EvaluationCommand): Promise<EvaluationView>;
}

export interface EvaluationServiceDependencies {
  readonly repositories: Repositories;
  readonly regulationInForceOn: (on: CalendarDate) => Promise<RegulationDocument>;
  /** Id of the signed-in account. Used when neither the input nor a supervisor names an evaluator. */
  readonly currentAccountId?: () => Promise<string>;
}

const notFound = (id: string) => new ServiceError('not_found', `Evaluation ${id} not found`);

const eventDate = (detail: EvaluationDetail, kinds: readonly string[]): CalendarDate | null =>
  detail.events.filter((event) => kinds.includes(event.kind)).at(-1)?.occurredOn ?? null;

export function createEvaluationService(
  dependencies: EvaluationServiceDependencies,
): EvaluationService {
  const { repositories, regulationInForceOn, currentAccountId } = dependencies;

  async function regulationOf(detail: EvaluationDetail): Promise<RegulationDocument> {
    const regulation = await repositories.regulationVersions.findOfficialById(detail.regulationId);
    if (regulation === null) {
      throw new ServiceError(
        'unknown_regulation',
        `Unknown regulation version ${detail.regulationId}`,
      );
    }
    return regulation;
  }

  async function load(id: string): Promise<EvaluationDetail> {
    const detail = await repositories.evaluations.get(id);
    if (detail === null) throw notFound(id);
    return detail;
  }

  async function view(detail: EvaluationDetail): Promise<EvaluationView> {
    const regulation = await regulationOf(detail);
    const { content } = detail.sheet;
    const criteria = sheetCriteria(regulation, detail.sheetId, content.partOne.additionalCriteria);
    // Drafts may hold off-scale ratings (the approval gate reports them), so score only valid ones.
    const allowed = new Set(regulation.partialScale.levels.map((level) => level.points));
    const ratings = Object.fromEntries(
      Object.entries(content.partTwo.ratings).filter(([, points]) => allowed.has(points)),
    );
    return { ...detail, criteria, score: scoreSheet(regulation, criteria, ratings) };
  }

  async function refreshDeadlines(id: string): Promise<EvaluationView> {
    const detail = await load(id);
    const regulation = await regulationOf(detail);
    await repositories.evaluations.saveDeadlines(
      id,
      computeEvaluationDeadlines(detail, regulation),
    );
    return view(await load(id));
  }

  function wrapStale(error: unknown): never {
    if (error instanceof RepositoryError && error.code === 'stale_status') {
      throw new ServiceError('stale_status', 'The evaluation changed in the meantime, reload it');
    }
    if (error instanceof RepositoryError && error.code === 'invalid_transition') {
      throw new ServiceError('invalid_transition', error.message);
    }
    throw error;
  }

  async function resolveEvaluator(
    input: StartEvaluationInput,
    supervisorEmployeeId: string | null,
  ): Promise<string> {
    if (input.evaluatorAccountId !== undefined) return input.evaluatorAccountId;
    if (supervisorEmployeeId !== null) {
      const supervisor = await repositories.employees.get(supervisorEmployeeId);
      if (supervisor?.userId) return supervisor.userId;
    }
    if (currentAccountId === undefined) {
      throw new ServiceError('not_found', 'No evaluator account could be determined');
    }
    return currentAccountId();
  }

  return {
    async start(input) {
      const employee = await repositories.employees.get(input.employeeId);
      if (employee === null)
        throw new ServiceError('not_found', `Employee ${input.employeeId} not found`);
      const eligibility = evaluationEligibility(employee);
      if (!eligibility.eligible) {
        throw new ServiceError(
          'not_eligible',
          `Employee cannot be evaluated: ${eligibility.reason}`,
          { reason: eligibility.reason },
        );
      }
      const evaluatorAccountId = await resolveEvaluator(input, employee.supervisorEmployeeId);

      const previous = await repositories.evaluations.latestForEmployee(employee.id);
      if (previous !== null && previous.status !== 'closed' && previous.status !== 'interrupted') {
        throw new ServiceError(
          'not_eligible',
          'The employee already has an evaluation in progress',
          { reason: 'evaluation_in_progress' },
        );
      }
      const previousApprovedOn = previous === null ? null : eventDate(previous, ['sheet_approved']);
      const cycleStart = input.cycleStart ?? previousApprovedOn ?? input.today;
      let afterNegative = false;
      if (previous !== null && previousApprovedOn !== null) {
        const previousRegulation = await regulationOf(previous);
        const criteria = sheetCriteria(
          previousRegulation,
          previous.sheetId,
          previous.sheet.content.partOne.additionalCriteria,
        );
        try {
          afterNegative =
            scoreSheet(previousRegulation, criteria, previous.sheet.content.partTwo.ratings)
              .outcome === 'negative';
        } catch (error) {
          // An off-scale rating gives the previous sheet no outcome, so it is not negative.
          if (!(error instanceof RangeError)) throw error;
        }
      }

      const regulation = await regulationInForceOn(cycleStart);
      const regulationVersionId = await repositories.regulationVersions.findOfficialRowId(
        regulation.id,
      );
      if (regulationVersionId === null) {
        throw new ServiceError('unknown_regulation', `Unknown regulation version ${regulation.id}`);
      }
      const created = await repositories.evaluations.create({
        employeeId: employee.id,
        evaluatorAccountId,
        regulationVersionId,
        sheetId: input.sheetId ?? proposeSheet(regulation, employee.positionKind),
        cycleStart,
        afterNegative,
        previousEvaluationId: previous?.id ?? null,
        previousAcquaintedOn:
          previous === null ? null : eventDate(previous, ['acquainted', 'signature_refused']),
        snapshot: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          positionTitle: employee.positionTitle,
          orgUnit: employee.orgUnit,
          serviceStatus: employee.serviceStatus,
          grade: employee.grade,
          appointmentYear: employee.appointmentYear,
          gradeGrantedOn: employee.gradeGrantedOn,
        },
        content: emptySheetContent(),
      });
      return refreshDeadlines(created.id);
    },

    async get(id) {
      const detail = await repositories.evaluations.get(id);
      return detail === null ? null : view(detail);
    },

    list: (filter = {}) => repositories.evaluations.listForOffice(filter),

    async saveDraft(id, content) {
      const parsed = sheetContentSchema.parse(content);
      const detail = await load(id);
      const locked =
        detail.sheet.state !== 'draft' ||
        !(
          ['criteria', 'criteria_awaiting_signature', 'period', 'interview'] as EvaluationStatus[]
        ).includes(detail.status);
      if (locked) {
        if (sameJson(detail.sheet.content, parsed)) return view(detail);
        throw new ServiceError('part_locked', 'The sheet is locked');
      }
      if (detail.status !== 'criteria' && !sameJson(detail.sheet.content.partOne, parsed.partOne)) {
        throw new ServiceError('part_locked', 'Part one cannot change after it was approved');
      }
      try {
        await repositories.evaluations.saveDraft(id, parsed);
      } catch (error) {
        wrapStale(error);
      }
      return refreshDeadlines(id);
    },

    async transition(id, command) {
      const detail = await load(id);
      let plan;
      try {
        plan = planTransition(detail.status, command);
      } catch (error) {
        if (error instanceof TransitionError) {
          throw new ServiceError('invalid_transition', error.message);
        }
        throw error;
      }
      const regulation = await regulationOf(detail);
      const { content } = detail.sheet;

      if (command.type === 'approve_part_one') {
        const computed =
          computeEvaluationDeadlines(
            {
              ...detail,
              sheet: {
                ...detail.sheet,
                content: { ...content, partOne: { ...content.partOne, dueOn: null } },
              },
            },
            regulation,
          ).find((slot) => slot.slot === 'evaluationDeadline')?.dueOn ?? null;
        const issues = partOneIssues(regulation, detail.sheetId, content, computed);
        if (issues.length > 0) {
          throw new ServiceError('criteria_invalid', 'Part one is not valid', issues);
        }
      }
      if (command.type === 'approve_sheet') {
        const issues: ApprovalIssue[] = sheetApprovalIssues({
          regulation,
          sheetId: detail.sheetId,
          content,
          evaluated: detail.snapshot,
        });
        if (issues.length > 0) {
          throw new ServiceError('approval_blocked', 'The sheet cannot be approved', issues);
        }
      }

      if (command.type === 'close_after_objection_window') {
        const dueOn = detail.deadlines.find((slot) => slot.slot === 'objection')?.dueOn ?? null;
        if (dueOn === null || command.closedOn <= dueOn) {
          throw new ServiceError(
            'approval_blocked',
            'The objection window is still open on the closing date',
            [{ code: 'objection_window_open' }],
          );
        }
      }

      try {
        await repositories.evaluations.applyTransition({
          evaluationId: id,
          expectedStatus: detail.status,
          nextStatus: plan.next,
          eventKind: plan.eventKind as EvaluationEventKind,
          occurredOn: plan.occurredOn,
          payload: {},
          lockSheet: plan.lockSheet,
        });
      } catch (error) {
        wrapStale(error);
      }
      return refreshDeadlines(id);
    },
  };
}
