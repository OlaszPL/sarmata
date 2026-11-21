import {
  type RegulationCase,
  type RegulationDocument,
  parseRegulationDocument,
  runRegulationCases,
} from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialCases, officialRegulations } from './index';

const regulation = officialRegulations[0];
const cases = officialCases['regulation-2016'];
if (!regulation || !cases) throw new Error('missing regulation-2016');

const deadlineCase = cases.find((item) => item.id === 'kprm-evaluation-24m');
const scoreCase = cases.find((item) => item.id === 'ex-9');
if (deadlineCase?.kind !== 'deadline' || scoreCase?.kind !== 'score') {
  throw new Error('missing reference cases');
}

const withMonths = (months: number): RegulationDocument => {
  const rule = regulation.deadlines.evaluationDeadline;
  if (rule?.strategy !== 'monthsFromEvent') throw new Error('unexpected strategy');
  return parseRegulationDocument({
    ...regulation,
    deadlines: { ...regulation.deadlines, evaluationDeadline: { ...rule, months } },
  });
};

describe('runRegulationCases', () => {
  it('deadline case passes on regulation-2016', () => {
    expect(runRegulationCases(regulation, [deadlineCase])[0]).toMatchObject({
      caseId: 'kprm-evaluation-24m',
      status: 'passed',
      message: null,
    });
  });

  it('changed months fail with expected and actual', () => {
    const [result] = runRegulationCases(withMonths(12), [deadlineCase]);
    expect(result).toMatchObject({
      status: 'failed',
      expected: { kind: 'due', due: '2026-03-16' },
      actual: { kind: 'due', due: '2025-03-17' },
    });
  });

  it('missing slot is an error result', () => {
    const deadlines = { ...regulation.deadlines };
    delete deadlines.evaluationDeadline;
    const without = parseRegulationDocument({ ...regulation, deadlines });
    const [result] = runRegulationCases(without, [deadlineCase]);
    expect(result?.status).toBe('error');
    expect(result?.message).toContain('evaluationDeadline');
  });

  it('off-scale score case is an error result', () => {
    const offScale: RegulationCase = {
      ...scoreCase,
      ratings: { ...scoreCase.ratings, communication: 4 },
    };
    const [result] = runRegulationCases(regulation, [offScale]);
    expect(result?.status).toBe('error');
  });

  it('unknown sheet is an error result', () => {
    const [result] = runRegulationCases(regulation, [{ ...scoreCase, sheetId: 'Z' }]);
    expect(result?.status).toBe('error');
  });

  it.each(cases.map((item) => [item.id, item] as const))('official case %s passes', (_id, item) => {
    expect(runRegulationCases(regulation, [item])[0]?.status).toBe('passed');
  });

  it('every official case passes', () => {
    const statuses = runRegulationCases(regulation, cases).map((result) => result.status);
    expect(statuses.every((status) => status === 'passed')).toBe(true);
  });
});
