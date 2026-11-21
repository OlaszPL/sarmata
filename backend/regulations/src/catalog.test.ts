import { RegulationDocumentError, parseRegulationDocument } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import rules2016 from '../regulation-2016/rules.json';
import { officialRegulations } from './index';

type RawDocument = typeof rules2016;

const parseMutated = (mutate: (document: RawDocument) => void) => () => {
  const document = structuredClone(rules2016);
  mutate(document);
  return parseRegulationDocument(document);
};

describe('official regulation catalog', () => {
  it('contains only the law in force', () => {
    expect(officialRegulations.map((version) => version.id)).toEqual(['regulation-2016']);
  });

  it('defines every deadline slot of the 2016 regulation', () => {
    const version = officialRegulations[0];
    expect(Object.keys(version?.deadlines ?? {}).sort()).toEqual([
      'criteriaResetAfterPositionChange',
      'evaluationDeadline',
      'evaluationOnPositionChange',
      'gradeByLawGrant',
      'labourCourtAppeal',
      'objection',
      'objectionDecision',
      'reevaluationAfterNegative',
      'startingInterview',
      'startingInterviewAfterNegative',
    ]);
  });

  it('lists the 14 criteria of annex 1 and the mandatory criteria of sheet C (§ 4 ust. 3)', () => {
    const version = officialRegulations[0];
    expect(version?.criteria.catalog).toHaveLength(14);
    expect(version?.sheets.find((sheet) => sheet.id === 'C')?.mandatoryCriteria).toEqual([
      'knowledge-use',
      'reliability',
      'work-organization',
      'cooperation',
      'communication',
    ]);
  });
});

describe('regulation document schema', () => {
  it.each([
    [
      'a sheet refers to an unknown criterion',
      (document: RawDocument) => document.sheets[2]?.mandatoryCriteria.push('telepathy'),
      /unknown criterion telepathy/,
    ],
    [
      'an unknown deadline slot',
      (document: RawDocument) => {
        Object.assign(document.deadlines, { coffeeBreak: document.deadlines.objection });
      },
      /deadlines/,
    ],
    [
      'a deadline without legal basis',
      (document: RawDocument) => {
        Reflect.deleteProperty(document.deadlines.objection, 'basis');
      },
      /basis/,
    ],
    [
      'an unknown strategy',
      (document: RawDocument) => {
        document.deadlines.objection.strategy = 'whenever';
      },
      /strategy/,
    ],
    [
      'a gap between level bands',
      (document: RawDocument) => {
        const band = document.overallLevel.bands[2];
        if (band) band.min = 4.5;
      },
      /bands must be contiguous/,
    ],
    [
      'an unknown level in the outcome',
      (document: RawDocument) => {
        document.outcome.negativeIfAnyPartialIs = 'awful';
      },
      /unknown level awful/,
    ],
    [
      'more additional criteria at minimum than at maximum',
      (document: RawDocument) => {
        document.additionalCriteria.min = 4;
      },
      /min is greater than max/,
    ],
    [
      'a date that does not exist',
      (document: RawDocument) => {
        document.effectiveFrom = '2016-02-30';
      },
      /invalid date 2016-02-30/,
    ],
    [
      'a property the schema does not know',
      (document: RawDocument) => {
        Object.assign(document, { comment: 'draft' });
      },
      /comment/,
    ],
  ])('rejects %s', (_name, mutate, message) => {
    const parse = parseMutated(mutate);
    expect(parse).toThrow(RegulationDocumentError);
    expect(parse).toThrow(message);
  });
});
