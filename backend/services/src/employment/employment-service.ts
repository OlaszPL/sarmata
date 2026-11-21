import { endEmploymentInputSchema, retentionEndsOn } from '@sarmata/domain';
import type { EndEmploymentInput } from '@sarmata/domain';
import {
  type EmployeeRepository,
  type EmploymentRepository,
  type EvaluationRepository,
  type RetentionOverviewRow,
  RepositoryError,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';

export interface EndEmploymentResult {
  /** Open evaluations of the employee that were interrupted. */
  readonly interruptedEvaluationIds: string[];
  /** Open evaluations of other people that the employee leads. Hr hands them over (change of evaluator). */
  readonly openAsEvaluator: number;
}

export interface EmploymentService {
  /**
   * Hr marks the end of an employment: interrupts the open evaluations of the employee, ends the access
   * of the account and starts the retention clock of 10 years from the end of the year (art. 94 pkt 9b KP).
   * Throws `ZodError` for invalid input, `already_ended` and `forbidden` (hr only).
   */
  end(input: EndEmploymentInput): Promise<EndEmploymentResult>;
  /** Former employees whose retention ends within the window (hr only: anybody else gets `forbidden`). */
  overview(withinDays?: number): Promise<RetentionOverviewRow[]>;
}

export interface EmploymentServiceDependencies {
  readonly employment: EmploymentRepository;
  readonly employees: Pick<EmployeeRepository, 'get'>;
  readonly evaluations: Pick<EvaluationRepository, 'listForOffice'>;
}

/** Maps the failures the SQL raises on purpose. */
function mapped(error: unknown): unknown {
  if (error instanceof RepositoryError) {
    if (error.code === 'already_ended') {
      return new ServiceError('already_ended', 'The employment of this employee has already ended');
    }
    if (error.code === 'not_ended') {
      return new ServiceError('not_ended', 'The employment of this employee has not ended');
    }
    if (error.code === '42501') {
      return new ServiceError('forbidden', 'Only hr can do this');
    }
  }
  return error;
}

export function createEmploymentService(deps: EmploymentServiceDependencies): EmploymentService {
  return {
    async end(rawInput) {
      const input = endEmploymentInputSchema.parse(rawInput);
      try {
        const employee = await deps.employees.get(input.employeeId);
        if (employee === null) throw new ServiceError('not_found', 'Employee not found');
        const openAsEvaluator =
          employee.userId === null
            ? 0
            : (
                await deps.evaluations.listForOffice({ evaluatorAccountId: employee.userId })
              ).filter(
                (evaluation) =>
                  evaluation.status !== 'closed' &&
                  evaluation.status !== 'interrupted' &&
                  evaluation.employeeId !== employee.id,
              ).length;
        const { interruptedEvaluationIds } = await deps.employment.end({
          employeeId: input.employeeId,
          endedOn: input.endedOn,
          reason: input.reason,
          purgeDueOn: retentionEndsOn(input.endedOn),
        });
        return { interruptedEvaluationIds, openAsEvaluator };
      } catch (error) {
        throw mapped(error);
      }
    },

    async overview(withinDays) {
      try {
        return await deps.employment.retentionOverview(withinDays);
      } catch (error) {
        throw mapped(error);
      }
    },
  };
}
