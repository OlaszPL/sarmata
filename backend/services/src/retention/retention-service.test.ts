import { type RetainedEvaluationFacts, calendarDate, sheetCriteria } from '@sarmata/domain';
import { type RetentionEvaluationSource, type RetentionStore } from '@sarmata/repositories';
import { officialRegulations } from '@sarmata/regulations';
import { describe, expect, it } from 'vitest';
import { RetentionRunError, createRetentionService } from './retention-service';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');
const criteria = sheetCriteria(regulation, 'C', []);

const source = (evaluationId: string): RetentionEvaluationSource => ({
  evaluationId,
  status: 'closed',
  sheetId: 'C',
  lockedContent: {
    partOne: { additionalCriteria: [], dueOn: null },
    partTwo: {
      interviewOn: null,
      periodFrom: null,
      periodTo: null,
      ratings: Object.fromEntries(criteria.map((id) => [id, 5])),
      justification: '',
      developmentConclusions: '',
      gradeRequest: null,
    },
  },
  orgUnit: 'Wydział A',
  serviceStatus: 'employee',
  gradeGrantedOn: null,
  drafted: calendarDate('2014-03-01'),
  acquaintedOn: calendarDate('2014-03-05'),
  history: [],
  objection: 'none',
  labourCourtAppealOn: null,
  evaluatorAccountId: 'a1',
  regulation,
});

interface Calls {
  purged: string[];
  anonymized: { employeeId: string; facts: readonly RetainedEvaluationFacts[] }[];
}

function fakeStore(options: { due: string[]; failing?: string[] }): {
  store: RetentionStore;
  calls: Calls;
} {
  const pending = new Set(options.due);
  const calls: Calls = { purged: [], anonymized: [] };
  const store: RetentionStore = {
    purgeExpiredContent: (day) => {
      calls.purged.push(day);
      return Promise.resolve({ notes: 3, aiRuns: 2, decisions: 1 });
    },
    dueEmployees: () =>
      Promise.resolve([...pending].map((employeeId) => ({ employeeId, officeId: 'o1' }))),
    evaluationsOf: (employeeId) =>
      Promise.resolve([source(`${employeeId}-e1`), { ...source('x'), status: 'interrupted' }]),
    anonymize: (employeeId, _day, facts) => {
      if (options.failing?.includes(employeeId)) return Promise.reject(new Error('boom'));
      calls.anonymized.push({ employeeId, facts });
      pending.delete(employeeId);
      return Promise.resolve();
    },
  };
  return { store, calls };
}

describe('retention service', () => {
  it('run purges content then anonymizes due employees', async () => {
    const { store, calls } = fakeStore({ due: ['p1', 'p2'] });
    const report = await createRetentionService({ store }).run(calendarDate('2026-11-21'));
    expect(report).toEqual({ notes: 3, aiRuns: 2, anonymized: 2, failed: 0 });
    expect(calls.purged).toEqual(['2026-11-21']);
    expect(calls.anonymized.map((call) => call.employeeId)).toEqual(['p1', 'p2']);
  });

  it('facts skip evaluations the statistics do not count', async () => {
    const { store, calls } = fakeStore({ due: ['p1'] });
    await createRetentionService({ store }).run(calendarDate('2026-11-21'));
    expect(calls.anonymized[0]?.facts.map((fact) => fact.evaluationId)).toEqual(['p1-e1']);
  });

  it('run continues after one employee fails and rethrows', async () => {
    const { store, calls } = fakeStore({ due: ['p1', 'p2', 'p3'], failing: ['p2'] });
    const logged: string[] = [];
    const run = createRetentionService({ store, log: (line) => logged.push(line) }).run(
      calendarDate('2026-11-21'),
    );
    const error: unknown = await run.then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(RetentionRunError);
    expect((error as RetentionRunError).report).toEqual({
      notes: 3,
      aiRuns: 2,
      anonymized: 2,
      failed: 1,
    });
    expect(calls.anonymized.map((call) => call.employeeId)).toEqual(['p1', 'p3']);
    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toContain('boom');
  });

  it('run twice does nothing the second time', async () => {
    const { store } = fakeStore({ due: ['p1'] });
    const service = createRetentionService({ store });
    await service.run(calendarDate('2026-11-21'));
    expect(await service.run(calendarDate('2026-11-21'))).toEqual({
      notes: 3,
      aiRuns: 2,
      anonymized: 0,
      failed: 0,
    });
  });
});
