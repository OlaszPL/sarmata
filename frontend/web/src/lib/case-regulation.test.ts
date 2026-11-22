import { type EvaluationView, type RegulationDocument } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { caseRegulationOf, levelName } from './case-regulation';

const document = {
  id: 'regulation-2016',
  name: 'Ocena okresowa 2016',
  effectiveFrom: '2016-04-23',
  partialScale: {
    basis: '§ 11',
    levels: [
      { code: 'far-below', name: 'znacznie poniżej oczekiwań', points: 1 },
      { code: 'below', name: 'poniżej oczekiwań', points: 3 },
      { code: 'meets', name: 'na poziomie oczekiwań', points: 5 },
    ],
  },
  overallLevel: {
    basis: '§ 11',
    method: 'arithmeticMean',
    bands: [
      { code: 'far-below', min: 1, minInclusive: true, max: 2 },
      { code: 'below', min: 2, minInclusive: false, max: 4 },
      { code: 'meets', min: 4, minInclusive: false, max: 5 },
    ],
  },
  outcome: { basis: '§ 11', positiveLevels: ['meets'], negativeIfAnyPartialIs: 'far-below' },
  justification: { basis: '§ 12', requiredForNegative: true, requiredForPositive: false },
  criteria: {
    basis: '§ 2',
    catalog: [
      { id: 'reliability', name: 'Rzetelność', indicators: ['terminowość'] },
      { id: 'communication', name: 'Komunikacja', indicators: ['jasność', 'słuchanie'] },
      { id: 'creativity', name: 'Kreatywność', indicators: ['pomysły'] },
    ],
  },
  additionalCriteria: { basis: '§ 5', min: 0, max: 3, fromMandatoryAllowed: false },
  sheets: [
    {
      id: 'C',
      annex: 3,
      positionKind: 'other',
      basis: 'zał. 3',
      position: 'inne',
      mandatoryCriteria: ['reliability', 'communication'],
      orgUnitFields: true,
      objectionAddressee: null,
    },
  ],
} as unknown as RegulationDocument;

const view = {
  regulationId: 'regulation-2016',
  sheetId: 'C',
  criteria: ['reliability', 'communication', 'creativity'],
} as unknown as EvaluationView;

describe('caseRegulationOf', () => {
  const regulation = caseRegulationOf(document, view);

  it('lists the criteria of the case in rating order with their indicators', () => {
    expect(regulation.criteria).toEqual([
      { id: 'reliability', name: 'Rzetelność', indicators: ['terminowość'], mandatory: true },
      {
        id: 'communication',
        name: 'Komunikacja',
        indicators: ['jasność', 'słuchanie'],
        mandatory: true,
      },
      { id: 'creativity', name: 'Kreatywność', indicators: ['pomysły'], mandatory: false },
    ]);
  });

  it('gives the scale with short tile labels and full names', () => {
    expect(regulation.scale).toEqual([
      { value: 1, label: 'Znacznie poniżej', name: 'znacznie poniżej oczekiwań' },
      { value: 3, label: 'Poniżej', name: 'poniżej oczekiwań' },
      { value: 5, label: 'Na poziomie', name: 'na poziomie oczekiwań' },
    ]);
  });

  it('gives the catalog for additional criteria and the limit', () => {
    expect(regulation.catalog.map((criterion) => criterion.id)).toEqual([
      'reliability',
      'communication',
      'creativity',
    ]);
    expect(regulation.additionalMax).toBe(3);
    expect(regulation.mandatoryIds).toEqual(['reliability', 'communication']);
  });

  it('labels the bands of the overall level', () => {
    expect(regulation.bands.map((band) => band.label)).toEqual(['do 2', '2 do 4', 'ponad 4']);
    expect(regulation.bands[1]).toMatchObject({ code: 'below', name: 'poniżej oczekiwań' });
  });

  it('says which partial rating makes the evaluation negative', () => {
    expect(regulation.negativePoints).toBe(1);
    expect(regulation.justificationRequiredForNegative).toBe(true);
    expect(regulation.outcomeBasis).toBe('§ 11');
    expect(regulation.effectiveFrom).toBe('2016-04-23');
  });

  it('names a level by its code', () => {
    expect(levelName(regulation, 'meets')).toBe('na poziomie oczekiwań');
    expect(levelName(regulation, null)).toBeNull();
  });
});
