import {
  type HistoryEntry,
  calendarDate,
  gradeByLawDue,
  secondConsecutiveNegative,
} from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');

const entry = (
  drafted: string,
  levelCode: string | null,
  outcome: 'positive' | 'negative' | null,
  acquaintedOn: string | null,
): HistoryEntry => ({
  drafted: calendarDate(drafted),
  levelCode,
  outcome,
  acquaintedOn: acquaintedOn === null ? null : calendarDate(acquaintedOn),
});

const granted = calendarDate('2020-01-10');

describe('gradeByLawDue', () => {
  it('grade by law due after above then far-above', () => {
    const result = gradeByLawDue(regulation, {
      serviceStatus: 'civil_servant',
      gradeGrantedOn: granted,
      history: [
        entry('2021-03-01', 'above', 'positive', '2021-03-08'),
        entry('2023-03-01', 'far-above', 'positive', '2023-03-06'),
      ],
    });
    expect(result).toEqual({ dueOn: '2023-04-05' });
  });

  it('grade by law not due when one level is meets', () => {
    expect(
      gradeByLawDue(regulation, {
        serviceStatus: 'civil_servant',
        gradeGrantedOn: granted,
        history: [
          entry('2021-03-01', 'above', 'positive', '2021-03-08'),
          entry('2023-03-01', 'meets', 'positive', '2023-03-06'),
        ],
      }),
    ).toBeNull();
  });

  it('ignores evaluations before the grade was granted and non civil servants', () => {
    const history = [
      entry('2019-03-01', 'far-above', 'positive', '2019-03-08'),
      entry('2021-03-01', 'far-above', 'positive', '2021-03-08'),
    ];
    expect(
      gradeByLawDue(regulation, {
        serviceStatus: 'civil_servant',
        gradeGrantedOn: granted,
        history,
      }),
    ).toBeNull();
    expect(
      gradeByLawDue(regulation, { serviceStatus: 'employee', gradeGrantedOn: null, history }),
    ).toBeNull();
  });
});

describe('secondConsecutiveNegative', () => {
  it('second consecutive negative detected', () => {
    expect(
      secondConsecutiveNegative([
        entry('2021-03-01', 'meets', 'positive', null),
        entry('2023-03-01', 'far-below', 'negative', null),
        entry('2023-10-01', 'far-below', 'negative', null),
      ]),
    ).toBe(true);
    expect(
      secondConsecutiveNegative([
        entry('2023-03-01', 'far-below', 'negative', null),
        entry('2023-10-01', 'meets', 'positive', null),
      ]),
    ).toBe(false);
  });
});
