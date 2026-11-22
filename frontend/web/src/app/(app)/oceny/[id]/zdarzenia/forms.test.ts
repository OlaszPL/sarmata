import { type SheetContent } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import {
  absenceSchema,
  acquaintanceSchema,
  interruptionSchema,
  positionChangeSchema,
  sheetFromForm,
  termChangeSchema,
  witnessList,
} from './forms';

const current: SheetContent = {
  partOne: { additionalCriteria: [], dueOn: null },
  partTwo: {
    interviewOn: null,
    periodFrom: null,
    periodTo: null,
    ratings: { cooperation: 1 },
    justification: 'stare',
    developmentConclusions: '',
    gradeRequest: { kind: 'positive' } as never,
  },
};

describe('witnessList', () => {
  it('trims and drops empty lines', () => {
    expect(witnessList('Jan Nowak\n\n  Anna Kowal ')).toEqual(['Jan Nowak', 'Anna Kowal']);
  });
});

describe('sheetFromForm', () => {
  it('reports a missing rating on its field', () => {
    const result = sheetFromForm({ 'rating-reliability': '5' }, current, [
      'reliability',
      'cooperation',
    ]);
    expect(result).toEqual({ fieldErrors: { 'rating-cooperation': 'Wybierz ocenę cząstkową' } });
  });

  it('builds numeric ratings and keeps the rest of the sheet', () => {
    const result = sheetFromForm(
      {
        'rating-reliability': '5',
        'rating-cooperation': '3',
        justification: 'Nowe uzasadnienie',
        developmentConclusions: 'Szkolenie',
      },
      current,
      ['reliability', 'cooperation'],
    );
    if (!('content' in result)) throw new Error('expected content');
    expect(result.content.partTwo.ratings).toEqual({ reliability: 5, cooperation: 3 });
    expect(result.content.partTwo.justification).toBe('Nowe uzasadnienie');
    expect(result.content.partTwo.developmentConclusions).toBe('Szkolenie');
    expect(result.content.partTwo.gradeRequest).toEqual(current.partTwo.gradeRequest);
    expect(result.content.partOne).toEqual(current.partOne);
  });
});

function messages(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries((result.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]));
}

describe('schemas', () => {
  it('rejects a return date before the start on the to field', () => {
    const result = absenceSchema.safeParse({ from: '2027-02-10', to: '2027-02-01' });
    expect(messages(result)).toEqual({
      to: 'Data powrotu nie może być wcześniejsza niż początek nieobecności',
    });
  });

  it('accepts an ongoing absence as null', () => {
    const result = absenceSchema.safeParse({ from: '2027-02-10', to: '' });
    expect(result.success && result.data.to).toBeNull();
  });

  it('tells an empty date from a wrong one', () => {
    expect(messages(absenceSchema.safeParse({ from: '', to: '' }))).toEqual({ from: 'Wpisz datę' });
    expect(messages(absenceSchema.safeParse({ from: '2027-13-40', to: '' }))).toEqual({
      from: 'Wpisz poprawną datę',
    });
  });

  it('needs a signature choice for acquaintance', () => {
    expect(
      messages(acquaintanceSchema.safeParse({ acquaintedOn: '2027-02-10', signature: '' })),
    ).toEqual({
      signature: 'Zaznacz, czy osoba oceniana podpisała zapoznanie',
    });
  });

  it('needs a reason and a confirmation to interrupt', () => {
    expect(
      messages(
        interruptionSchema.safeParse({ interruptedOn: '2027-02-10', reason: ' ', confirm: '' }),
      ),
    ).toEqual({
      reason: 'Wpisz powód przerwania oceny',
      confirm: 'Potwierdź, że rozumiesz skutki przerwania',
    });
  });

  it('needs a reason for a term change', () => {
    expect(
      messages(
        termChangeSchema.safeParse({ newDueOn: '2027-05-01', reason: '', noticeOn: '2027-02-01' }),
      ),
    ).toEqual({ reason: 'Wybierz przyczynę zmiany terminu' });
  });

  it('turns an empty org unit into null', () => {
    const result = positionChangeSchema.safeParse({
      changedOn: '2027-02-01',
      positionTitle: 'Specjalista',
      orgUnit: '',
      significant: 'no',
      justification: 'Powód',
    });
    expect(result.success && result.data.orgUnit).toBeNull();
  });
});
