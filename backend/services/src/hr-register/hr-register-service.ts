import {
  type GradeGrantInput,
  type LabourCourtAppealInput,
  gradeGrantInputSchema,
  labourCourtAppealInputSchema,
} from '@sarmata/domain';
import { type GradeGrant, type HrRegisterRepository, RepositoryError } from '@sarmata/repositories';
import { ServiceError } from '../errors';

export interface HrRegisterService {
  /** hr only. Throws `ZodError` for invalid input. */
  recordLabourCourtAppeal(input: LabourCourtAppealInput): Promise<void>;
  /** hr only. A by law grant also closes the grade by law task of the evaluation. */
  recordGradeGrant(input: GradeGrantInput): Promise<void>;
  gradeGrants(employeeId: string): Promise<GradeGrant[]>;
}

const RULES = [
  'no_rejected_objection',
  'already_recorded',
  'date_before_outcome',
  'not_civil_servant',
  'grade_not_higher',
  'date_before_previous_grant',
  'evaluation_required',
] as const;

/** Postgres codes and rule names of the register RPCs to service errors. */
function mapError(error: unknown): never {
  if (error instanceof RepositoryError) {
    if (error.code === '42501') {
      throw new ServiceError('forbidden', 'Only hr can record this entry');
    }
    const rule =
      error.code === '23505'
        ? 'already_recorded'
        : RULES.find((name) => error.message.includes(name));
    if (rule !== undefined) {
      throw new ServiceError('hr_entry_rejected', `HR entry rejected: ${rule}`, { rule });
    }
  }
  throw error;
}

export function createHrRegisterService(deps: {
  repository: HrRegisterRepository;
}): HrRegisterService {
  const { repository } = deps;
  return {
    async recordLabourCourtAppeal(input) {
      const parsed = labourCourtAppealInputSchema.parse(input);
      try {
        await repository.recordLabourCourtAppeal(parsed);
      } catch (error) {
        mapError(error);
      }
    },

    async recordGradeGrant(input) {
      const parsed = gradeGrantInputSchema.parse(input);
      try {
        await repository.recordGradeGrant(parsed);
      } catch (error) {
        mapError(error);
      }
    },

    gradeGrants: (employeeId) => repository.gradeGrants(employeeId),
  };
}
