import type { RegulationDocument } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import {
  applyRegulationEdits,
  issueFieldId,
  regulationFields,
  regulationFormValues,
  regulationIssueErrors,
} from './regulation-form';

/** A small document with the shape of a regulation version. Schema validity is not checked here. */
const document = {
  id: 'regulation-test-local-1',
  name: 'Wersja testowa',
  effectiveFrom: '2027-01-01',
  legalBasis: 'ustawa testowa',
  sources: [
    {
      id: 'act',
      title: 'Ustawa',
      citation: 'Dz.U.',
      text: 'backend/regulations/test/sources/act.md',
    },
  ],
  partialScale: {
    basis: '§ 1',
    levels: [
      { code: 'low', name: 'poniżej oczekiwań', points: 1 },
      { code: 'high', name: 'powyżej oczekiwań', points: 5 },
    ],
  },
  overallLevel: {
    basis: '§ 2',
    method: 'arithmeticMean',
    bands: [
      { code: 'low', min: 1, minInclusive: true, max: 3 },
      { code: 'high', min: 3, minInclusive: false, max: 5 },
    ],
  },
  outcome: { basis: '§ 3', positiveLevels: ['high'], negativeIfAnyPartialIs: 'low' },
  justification: { basis: '§ 4', requiredForNegative: true, requiredForPositive: false },
  criteria: { basis: '§ 5', catalog: [{ id: 'quality', name: 'Jakość', indicators: ['a'] }] },
  additionalCriteria: { basis: '§ 6', min: 0, max: 3, fromMandatoryAllowed: false },
  sheets: [
    {
      id: 'A',
      annex: 1,
      positionKind: 'other',
      basis: '§ 7',
      position: 'Stanowisko',
      mandatoryCriteria: ['quality'],
      orgUnitFields: false,
      objectionAddressee: null,
    },
  ],
  deadlines: {
    evaluationDeadline: {
      strategy: 'monthsFromEvent',
      event: 'cycleStart',
      months: 24,
      extendByAbsencesLongerThanMonth: true,
      shiftToWorkingDay: true,
      basis: 'art. 81',
    },
    objection: {
      strategy: 'daysFromEvent',
      event: 'acquaintance',
      days: 7,
      shiftToWorkingDay: true,
      basis: 'art. 83 ust. 1',
    },
  },
  termChange: {
    basis: '§ 8',
    minimumElapsedMonths: 6,
    reasons: ['evaluatorChange'],
    writtenNoticeRequired: true,
  },
  gradeByLaw: {
    basis: 'art. 89',
    consecutiveEvaluations: 2,
    qualifyingLevels: ['high'],
    sameLevelRequired: false,
  },
  feedback: { basis: 'zarządzenie', ongoing: true, periodic: true },
} as unknown as RegulationDocument;

const allFields = () => regulationFields(document).flatMap((group) => group.fields);
const field = (id: string) => allFields().find((candidate) => candidate.id === id);

describe('regulationFields', () => {
  it('has a group per deadline slot with the slot label and basis', () => {
    const groups = regulationFields(document);
    const objection = groups.find((group) => group.title === 'Termin na sprzeciw');
    expect(objection?.basis).toBe('art. 83 ust. 1');
    expect(groups.some((group) => group.title === 'Termin sporządzenia oceny')).toBe(true);
  });

  it('ties the strategy parameters to their strategy', () => {
    expect(field('deadlines.objection.days')?.strategyOf).toEqual({
      slotField: 'deadlines.objection.strategy',
      strategies: ['daysFromEvent'],
    });
    expect(field('deadlines.objection.months')?.strategyOf).toEqual({
      slotField: 'deadlines.objection.strategy',
      strategies: ['monthsFromEvent'],
    });
    expect(field('deadlines.objection.strategy')?.kind).toBe('select');
    expect(field('deadlines.objection.basis')?.kind).toBe('text');
  });

  it('labels the bands with the level names', () => {
    expect(field('bands.1.min')?.label).toBe('Powyżej oczekiwań, średnia od');
  });
});

describe('regulationFormValues', () => {
  it('writes the current values as text', () => {
    const values = regulationFormValues(document);
    expect(values['additionalCriteria.max']).toBe('3');
    expect(values['justification.requiredForNegative']).toBe('1');
    expect(values['justification.requiredForPositive']).toBe('');
    expect(values['deadlines.objection.days']).toBe('7');
    expect(values['deadlines.objection.strategy']).toBe('daysFromEvent');
  });
});

describe('applyRegulationEdits', () => {
  it('changes only the edited field', () => {
    const values = { ...regulationFormValues(document), 'additionalCriteria.max': '2' };
    const edited = applyRegulationEdits(document, values) as RegulationDocument;
    expect(edited).toEqual({
      ...document,
      additionalCriteria: { ...document.additionalCriteria, max: 2 },
    });
    expect(document.additionalCriteria.max).toBe(3);
  });

  it('reads a decimal comma', () => {
    const values = { ...regulationFormValues(document), 'bands.0.max': '2,5' };
    const edited = applyRegulationEdits(document, values) as RegulationDocument;
    expect(edited.overallLevel.bands[0]?.max).toBe(2.5);
  });

  it('turns an empty number into NaN so the schema flags the field', () => {
    const values = { ...regulationFormValues(document), 'termChange.minimumElapsedMonths': ' ' };
    const edited = applyRegulationEdits(document, values) as RegulationDocument;
    expect(edited.termChange.minimumElapsedMonths).toBeNaN();
  });

  it('switches the strategy of a slot with the parameters of the new strategy', () => {
    const values = {
      ...regulationFormValues(document),
      'deadlines.objection.strategy': 'monthsFromEvent',
      'deadlines.objection.months': '1',
      'deadlines.objection.extendByAbsencesLongerThanMonth': '1',
    };
    const edited = applyRegulationEdits(document, values) as RegulationDocument;
    expect(edited.deadlines.objection).toEqual({
      strategy: 'monthsFromEvent',
      event: 'acquaintance',
      months: 1,
      extendByAbsencesLongerThanMonth: true,
      shiftToWorkingDay: true,
      basis: 'art. 83 ust. 1',
    });
    expect(edited.deadlines.objection).not.toHaveProperty('days');
  });

  it('reads a missing checkbox as false', () => {
    const values = regulationFormValues(document);
    delete values['justification.requiredForNegative'];
    delete values['deadlines.objection.shiftToWorkingDay'];
    const edited = applyRegulationEdits(document, values) as RegulationDocument;
    expect(edited.justification.requiredForNegative).toBe(false);
    expect(edited.deadlines.objection?.shiftToWorkingDay).toBe(false);
  });
});

describe('issueFieldId', () => {
  it('maps schema paths to form field ids', () => {
    expect(issueFieldId(['deadlines', 'objection', 'days'])).toBe('deadlines.objection.days');
    expect(issueFieldId(['additionalCriteria', 'min'])).toBe('additionalCriteria.min');
    expect(issueFieldId(['overallLevel', 'bands', 1, 'min'])).toBe('bands.1.min');
    expect(issueFieldId(['justification', 'requiredForPositive'])).toBe(
      'justification.requiredForPositive',
    );
  });

  it('returns an empty id for a path outside the form', () => {
    expect(issueFieldId(['sources', 0, 'text'])).toBe('');
    expect(issueFieldId(['effectiveFrom'])).toBe('');
    expect(issueFieldId(['deadlines', 'objection', 'unknownKey'])).toBe('');
  });
});

describe('regulationIssueErrors', () => {
  it('puts Polish messages on the fields and collects the rest', () => {
    const { fieldErrors, outside } = regulationIssueErrors(document, [
      {
        path: ['deadlines', 'objection', 'days'],
        message: 'Invalid input: expected number, received NaN',
      },
      { path: ['additionalCriteria', 'min'], message: 'min is greater than max' },
      { path: ['sources', 0, 'text'], message: 'expected a file' },
    ]);
    expect(fieldErrors['deadlines.objection.days']).toBe('Wpisz liczbę');
    expect(fieldErrors['additionalCriteria.min']).toMatch(/^Najmniejsza liczba/);
    expect(outside).toEqual(['Źródła / pozycja 1 / text']);
  });
});
