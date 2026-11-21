import { randomUUID } from 'node:crypto';

import {
  type ApprovalIssue,
  type CalendarDate,
  type EvaluationCommand,
  type EvaluationStatus,
  type RegulationDocument,
  type SheetContent,
  type SheetScore,
  type HistoryEntry,
  type ObjectionOutcome,
  type PositionChangePayload,
  TransitionError,
  absencePayloadSchema,
  commandPayload,
  gradeByLawDue,
  objectionFilingIssue,
  outcomeLowered,
  positionChangePayloadSchema,
  secondConsecutiveNegative,
  termChangeIssues,
  termChangePayloadSchema,
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
  type OfficeSettingsRepository,
  type Repositories,
  RepositoryError,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';
import { sameJson } from '../same-json';
import { computeEvaluationDeadlines, gradeByLawSlot } from './deadlines';

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
  /** From the snapshot, or from the last `position_changed` event. */
  readonly currentPosition: {
    readonly positionTitle: string | null;
    readonly orgUnit: string | null;
  };
  /** Who receives the objection: the office override (sheet A) or the text from the rules. */
  readonly objectionAddressee: string | null;
  readonly signals: {
    /** Grade by law (art. 89 ust. 2) is due, counted from the last acquaintance. */
    readonly gradeByLaw: { readonly dueOn: CalendarDate } | null;
    readonly secondConsecutiveNegative: boolean;
  };
  /** Hints for the evaluator from the rules. They never block anything. */
  readonly warnings: EvaluationWarning[];
};

/**
 * `grade_due_by_law`: the sheet requests a grade although it is already due by law (art. 89 ust. 2),
 * so the request is pointless. `second_consecutive_negative`: the second negative evaluation in a row (art. 71).
 * A warning about the evaluator being the DG who decides the objection is not possible: there is no DG role.
 */
export type EvaluationWarning =
  | { readonly code: 'grade_due_by_law'; readonly dueOn: CalendarDate }
  | { readonly code: 'second_consecutive_negative' };

export function warningsOf(
  content: SheetContent,
  signals: EvaluationView['signals'],
): EvaluationWarning[] {
  const warnings: EvaluationWarning[] = [];
  if (content.partTwo.gradeRequest !== null && signals.gradeByLaw !== null) {
    warnings.push({ code: 'grade_due_by_law', dueOn: signals.gradeByLaw.dueOn });
  }
  if (signals.secondConsecutiveNegative) warnings.push({ code: 'second_consecutive_negative' });
  return warnings;
}

export interface AbsenceInput {
  /** Pass the id of an earlier entry to complete it, e.g. with the return date. */
  readonly absenceId?: string;
  readonly from: CalendarDate;
  /** `null` while the absence is ongoing: the deadline is suspended. */
  readonly to: CalendarDate | null;
}

export interface TermChangeInput {
  readonly newDueOn: CalendarDate;
  readonly reason: string;
  readonly noticeOn: CalendarDate;
}

export interface EvaluatorChangeInput {
  readonly accountId: string;
  readonly occurredOn: CalendarDate;
  readonly reason: string;
}

export interface ObjectionDecisionInput {
  readonly outcome: ObjectionOutcome;
  readonly decidedOn: CalendarDate;
  /** Required for `changed`. */
  readonly content?: SheetContent;
}

export interface SheetCorrectionInput {
  readonly content: SheetContent;
  readonly reason: string;
}

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
  /** Filing an objection (`file_objection`) and interrupting (`interrupt`) are commands here too. */
  transition(id: string, command: EvaluationCommand): Promise<EvaluationView>;
  recordAbsence(id: string, input: AbsenceInput): Promise<EvaluationView>;
  changeTerm(id: string, input: TermChangeInput): Promise<EvaluationView>;
  recordPositionChange(id: string, input: PositionChangePayload): Promise<EvaluationView>;
  changeEvaluator(id: string, input: EvaluatorChangeInput): Promise<EvaluationView>;
  decideObjection(id: string, input: ObjectionDecisionInput): Promise<EvaluationView>;
  correctSheet(id: string, input: SheetCorrectionInput): Promise<EvaluationView>;
}

export interface EvaluationServiceDependencies {
  readonly repositories: Repositories;
  readonly regulationInForceOn: (on: CalendarDate) => Promise<RegulationDocument>;
  /** Id of the signed-in account. Used when neither the input nor a supervisor names an evaluator. */
  readonly currentAccountId?: () => Promise<string>;
  /** Source of `defaultPlace` and the sheet A addressee override. Without it the rules text applies. */
  readonly officeSettings?: OfficeSettingsRepository;
}

const notFound = (id: string) => new ServiceError('not_found', `Evaluation ${id} not found`);

const eventDate = (detail: EvaluationDetail, kinds: readonly string[]): CalendarDate | null =>
  detail.events.filter((event) => kinds.includes(event.kind)).at(-1)?.occurredOn ?? null;

export function createEvaluationService(
  dependencies: EvaluationServiceDependencies,
): EvaluationService {
  const { repositories, regulationInForceOn, currentAccountId, officeSettings } = dependencies;

  async function regulationOf(detail: EvaluationDetail): Promise<RegulationDocument> {
    const stored = await repositories.regulationVersions.findByCode(detail.regulationId);
    if (stored === null) {
      throw new ServiceError(
        'unknown_regulation',
        `Unknown regulation version ${detail.regulationId}`,
      );
    }
    return stored.document;
  }

  async function load(id: string): Promise<EvaluationDetail> {
    const detail = await repositories.evaluations.get(id);
    if (detail === null) throw notFound(id);
    return detail;
  }

  /** Scores valid ratings only: drafts may hold off-scale ones (the approval gate reports them). */
  function scoreOf(
    regulation: RegulationDocument,
    detail: EvaluationDetail,
    content: SheetContent,
  ) {
    const criteria = sheetCriteria(regulation, detail.sheetId, content.partOne.additionalCriteria);
    const allowed = new Set(regulation.partialScale.levels.map((level) => level.points));
    const ratings = Object.fromEntries(
      Object.entries(content.partTwo.ratings).filter(([, points]) => allowed.has(points)),
    );
    return { criteria, score: scoreSheet(regulation, criteria, ratings) };
  }

  function currentPositionOf(detail: EvaluationDetail): EvaluationView['currentPosition'] {
    const change = detail.events.filter((event) => event.kind === 'position_changed').at(-1);
    if (change === undefined) {
      return { positionTitle: detail.snapshot.positionTitle, orgUnit: detail.snapshot.orgUnit };
    }
    const { positionTitle, orgUnit } = positionChangePayloadSchema.parse(change.payload);
    return { positionTitle, orgUnit };
  }

  async function signalsAndOwnership(
    detail: EvaluationDetail,
    regulation: RegulationDocument,
    score: SheetScore,
  ): Promise<{ signals: EvaluationView['signals']; latest: boolean }> {
    const history: HistoryEntry[] = await repositories.evaluations.history(detail.employeeId);
    const drafted = eventDate(detail, ['sheet_approved']);
    const acquaintedOn = eventDate(detail, ['acquainted', 'signature_refused']);
    // A closed evaluation is already part of the history. Only a delivered evaluation counts, not
    // a redrafted copy or an interrupted one.
    const inForce = detail.status === 'delivered' || detail.status === 'objection';
    if (inForce && drafted !== null && acquaintedOn !== null) {
      history.push({ drafted, levelCode: score.levelCode, outcome: score.outcome, acquaintedOn });
    }
    const counted = inForce || detail.status === 'closed';
    // The signal clears once hr records the new grade, so it reads the employee's current date
    // and not the one frozen in the snapshot. The snapshot stays the fallback for a missing row.
    const employee = await repositories.employees.get(detail.employeeId);
    const last = [...history].sort((a, b) => a.drafted.localeCompare(b.drafted)).at(-1);
    const latest =
      counted &&
      last?.drafted === drafted &&
      last.acquaintedOn !== null &&
      last.acquaintedOn === acquaintedOn;
    return {
      signals: {
        gradeByLaw: gradeByLawDue(regulation, {
          serviceStatus: detail.snapshot.serviceStatus,
          gradeGrantedOn: employee?.gradeGrantedOn ?? detail.snapshot.gradeGrantedOn,
          history,
        }),
        secondConsecutiveNegative: secondConsecutiveNegative(history),
      },
      latest,
    };
  }

  async function signalsOf(
    detail: EvaluationDetail,
    regulation: RegulationDocument,
    score: SheetScore,
  ): Promise<EvaluationView['signals']> {
    return (await signalsAndOwnership(detail, regulation, score)).signals;
  }

  async function objectionAddresseeOf(
    detail: EvaluationDetail,
    regulation: RegulationDocument,
  ): Promise<string | null> {
    const rulesText =
      regulation.sheets.find((sheet) => sheet.id === detail.sheetId)?.objectionAddressee ?? null;
    if (detail.sheetId !== 'A' || officeSettings === undefined) return rulesText;
    return (await officeSettings.get())?.objectionAddresseeSheetA ?? rulesText;
  }

  async function view(detail: EvaluationDetail): Promise<EvaluationView> {
    const regulation = await regulationOf(detail);
    const { criteria, score } = scoreOf(regulation, detail, detail.sheet.content);
    const signals = await signalsOf(detail, regulation, score);
    return {
      ...detail,
      criteria,
      score,
      currentPosition: currentPositionOf(detail),
      objectionAddressee: await objectionAddresseeOf(detail, regulation),
      signals,
      warnings: warningsOf(detail.sheet.content, signals),
    };
  }

  async function refreshDeadlines(id: string): Promise<EvaluationView> {
    const detail = await load(id);
    const regulation = await regulationOf(detail);
    const { score } = scoreOf(regulation, detail, detail.sheet.content);
    const { signals, latest } = await signalsAndOwnership(detail, regulation, score);
    // The grade by law slot (an hr task) belongs only to the evaluation whose acquaintance completed
    // the qualifying run. Other evaluations of the employee show the signal but store no slot.
    await repositories.evaluations.saveDeadlines(id, [
      ...computeEvaluationDeadlines(detail, regulation),
      ...gradeByLawSlot(latest ? signals.gradeByLaw : null),
    ]);
    return view(await load(id));
  }

  function wrapStale(error: unknown): never {
    if (error instanceof RepositoryError && error.code === 'stale_status') {
      throw new ServiceError('stale_status', 'The evaluation changed in the meantime, reload it');
    }
    if (error instanceof RepositoryError && error.code === 'invalid_transition') {
      throw new ServiceError('invalid_transition', error.message);
    }
    if (error instanceof RepositoryError) {
      if (error.code === '42501') {
        throw new ServiceError('forbidden', 'Your role does not allow this action');
      }
      if (error.code === 'invalid_evaluator') {
        throw new ServiceError('invalid_evaluator', 'The new evaluator is not in this office');
      }
      if (error.code === 'no_locked_sheet') {
        throw new ServiceError('no_locked_sheet', 'The evaluation has no locked sheet');
      }
    }
    throw error;
  }

  /** Side events and an evaluator change belong to the open stages, not to a finished evaluation. */
  function assertOpen(detail: EvaluationDetail): void {
    if (detail.status === 'closed' || detail.status === 'interrupted') {
      throw new ServiceError(
        'invalid_transition',
        `The evaluation is ${detail.status} and accepts no further changes`,
      );
    }
  }

  async function recordSideEvent(
    detail: EvaluationDetail,
    kind: 'absence' | 'term_changed' | 'position_changed',
    occurredOn: CalendarDate,
    payload: Record<string, unknown>,
  ): Promise<void> {
    assertOpen(detail);
    try {
      await repositories.evaluations.recordEvent(detail.id, kind, occurredOn, payload);
    } catch (error) {
      wrapStale(error);
    }
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
      const pinned = await repositories.regulationVersions.findByCode(regulation.id);
      if (pinned === null) {
        throw new ServiceError('unknown_regulation', `Unknown regulation version ${regulation.id}`);
      }
      const regulationVersionId = pinned.rowId;
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

      if (command.type === 'file_objection') {
        const dueOn = detail.deadlines.find((slot) => slot.slot === 'objection')?.dueOn ?? null;
        if (objectionFilingIssue(dueOn, command.filedOn) !== null) {
          throw new ServiceError('objection_late', 'The objection deadline has passed', {
            dueOn,
            filedOn: command.filedOn,
          });
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

      const defaultPlace = (await officeSettings?.get())?.defaultPlace ?? null;
      try {
        await repositories.evaluations.applyTransition({
          evaluationId: id,
          expectedStatus: detail.status,
          nextStatus: plan.next,
          eventKind: plan.eventKind as EvaluationEventKind,
          occurredOn: plan.occurredOn,
          payload: commandPayload(command, defaultPlace),
          lockSheet: plan.lockSheet,
        });
      } catch (error) {
        wrapStale(error);
      }
      return refreshDeadlines(id);
    },

    async recordAbsence(id, input) {
      const detail = await load(id);
      const payload = absencePayloadSchema.parse({
        absenceId: input.absenceId ?? randomUUID(),
        from: input.from,
        to: input.to,
      });
      await recordSideEvent(detail, 'absence', payload.from, payload);
      return refreshDeadlines(id);
    },

    async changeTerm(id, input) {
      const detail = await load(id);
      assertOpen(detail);
      if (detail.afterNegative) {
        // The deadline after a negative result is the 7 day starting interview, not a cycle term.
        throw new ServiceError('term_change_invalid', 'The term cannot be changed', [
          'term_change_after_negative',
        ]);
      }
      const regulation = await regulationOf(detail);
      const issues = termChangeIssues(regulation, {
        cycleStart: detail.cycleStart,
        changedOn: input.noticeOn,
        reason: input.reason,
      });
      if (issues.length > 0) {
        throw new ServiceError('term_change_invalid', 'The term cannot be changed', issues);
      }
      const payload = termChangePayloadSchema.parse(input);
      await recordSideEvent(detail, 'term_changed', payload.noticeOn, payload);
      return refreshDeadlines(id);
    },

    async recordPositionChange(id, input) {
      const detail = await load(id);
      const payload = positionChangePayloadSchema.parse(input);
      await recordSideEvent(detail, 'position_changed', payload.changedOn, payload);
      return refreshDeadlines(id);
    },

    async changeEvaluator(id, input) {
      assertOpen(await load(id));
      try {
        await repositories.evaluations.changeEvaluator(
          id,
          input.accountId,
          input.occurredOn,
          input.reason,
        );
      } catch (error) {
        wrapStale(error);
      }
      return refreshDeadlines(id);
    },

    async decideObjection(id, input) {
      const detail = await load(id);
      if (detail.status !== 'objection') {
        throw new ServiceError('invalid_transition', 'The evaluation has no objection to decide');
      }
      let newContent: SheetContent | null = null;
      if (input.outcome === 'changed') {
        if (input.content === undefined) {
          throw new ServiceError('criteria_invalid', 'A changed outcome needs the new sheet', [
            { code: 'content_missing' },
          ]);
        }
        newContent = sheetContentSchema.parse(input.content);
        const regulation = await regulationOf(detail);
        const before = scoreOf(regulation, detail, detail.sheet.content).score;
        const after = scoreOf(regulation, detail, newContent).score;
        if (!after.complete) {
          throw new ServiceError('approval_blocked', 'The new sheet is incomplete', [
            { code: 'sheet_incomplete' },
          ]);
        }
        if (outcomeLowered(regulation, before, after)) {
          throw new ServiceError(
            'objection_lowers_outcome',
            'An objection cannot lower the evaluation outcome',
            { before: before.levelCode, after: after.levelCode },
          );
        }
        const issues = sheetApprovalIssues({
          regulation,
          sheetId: detail.sheetId,
          content: newContent,
          evaluated: detail.snapshot,
        });
        if (issues.length > 0) {
          throw new ServiceError('approval_blocked', 'The new sheet cannot be approved', issues);
        }
      }
      try {
        await repositories.evaluations.applyObjectionOutcome({
          evaluationId: id,
          outcome: input.outcome,
          occurredOn: input.decidedOn,
          payload: input.outcome === 'changed' ? { reason: 'objection' } : {},
          newContent,
        });
      } catch (error) {
        wrapStale(error);
      }
      return refreshDeadlines(id);
    },

    async correctSheet(id, input) {
      await load(id);
      const content = sheetContentSchema.parse(input.content);
      try {
        await repositories.evaluations.correctSheet(id, content, input.reason);
      } catch (error) {
        wrapStale(error);
      }
      return refreshDeadlines(id);
    },
  };
}
