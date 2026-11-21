import {
  type CalendarDate,
  type DevelopmentRecommendation,
  type TrainingItem,
  recommendDevelopment,
} from '@sarmata/domain';
import { type RegulationVersionRepository } from '@sarmata/repositories';
import { ServiceError } from '../errors';
import { type EvaluationService } from '../evaluations/evaluation-service';

export interface DevelopmentService {
  /**
   * Development suggestions for an evaluation (IPRZ): trainings, 70-20-10 actions and a draft of the
   * conclusions. A suggestion for the evaluator, who decides. `on` defaults to today. `not_found`
   * for an evaluation the account cannot see.
   */
  recommend(
    evaluationId: string,
    input?: { on?: CalendarDate },
  ): Promise<DevelopmentRecommendation>;
}

export interface DevelopmentServiceDependencies {
  readonly evaluations: Pick<EvaluationService, 'get'>;
  readonly regulations: Pick<RegulationVersionRepository, 'findByCode'>;
  readonly catalog: readonly TrainingItem[];
  readonly today: () => CalendarDate;
}

export function createDevelopmentService(
  dependencies: DevelopmentServiceDependencies,
): DevelopmentService {
  const { evaluations, regulations, catalog, today } = dependencies;
  return {
    async recommend(evaluationId, input) {
      const view = await evaluations.get(evaluationId);
      if (view === null) {
        throw new ServiceError('not_found', `Evaluation ${evaluationId} not found`);
      }
      const stored = await regulations.findByCode(view.regulationId);
      if (stored === null) {
        throw new ServiceError(
          'unknown_regulation',
          `Unknown regulation version ${view.regulationId}`,
        );
      }
      return recommendDevelopment({
        regulation: stored.document,
        sheetId: view.sheetId,
        ratings: view.sheet.content.partTwo.ratings,
        catalog,
        on: input?.on ?? today(),
      });
    },
  };
}
