import { calendarDate } from '@sarmata/domain';
import { officialRegulations, trainingCatalog } from '@sarmata/regulations';
import { describe, expect, it } from 'vitest';
import { ServiceError } from '../errors';
import { type EvaluationView } from '../evaluations/evaluation-service';
import { createDevelopmentService } from './development-service';

const [regulation] = officialRegulations;
if (regulation === undefined) throw new Error('The official regulation catalog is empty');

const viewWith = (ratings: Record<string, number>): EvaluationView =>
  ({
    id: 'ev1',
    regulationId: regulation.id,
    sheetId: 'C',
    sheet: { content: { partTwo: { ratings } } },
  }) as unknown as EvaluationView;

function service(view: EvaluationView | null) {
  return createDevelopmentService({
    evaluations: { get: () => Promise.resolve(view) },
    regulations: {
      findByCode: (code) =>
        Promise.resolve(
          code === regulation?.id
            ? { rowId: 'row-1', code, isOfficial: true, document: regulation }
            : null,
        ),
    },
    catalog: trainingCatalog,
    today: () => calendarDate('2026-11-21'),
  });
}

describe('development service', () => {
  it('recommend returns focus for the lowest ratings', async () => {
    // EX-9 on sheet C.
    const result = await service(
      viewWith({
        'knowledge-use': 5,
        reliability: 1,
        'work-organization': 5,
        cooperation: 1,
        communication: 1,
      }),
    ).recommend('ev1');
    expect(result.focus.map((item) => item.criterionId)).toEqual([
      'communication',
      'reliability',
      'cooperation',
    ]);
    expect(result.focus[0]?.trainings.length).toBeGreaterThan(0);
    expect(result.conclusionsDraft).toContain(result.focus[0]?.name);
  });

  it('unknown evaluation fails not_found', async () => {
    await expect(service(null).recommend('nope')).rejects.toBeInstanceOf(ServiceError);
    await expect(service(null).recommend('nope')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('empty ratings give no focus', async () => {
    const result = await service(viewWith({})).recommend('ev1');
    expect(result.focus).toEqual([]);
  });

  it('an evaluation on an unknown regulation fails unknown_regulation', async () => {
    const view = { ...viewWith({ communication: 1 }), regulationId: 'regulation-1999' };
    await expect(service(view).recommend('ev1')).rejects.toMatchObject({
      code: 'unknown_regulation',
    });
  });
});
