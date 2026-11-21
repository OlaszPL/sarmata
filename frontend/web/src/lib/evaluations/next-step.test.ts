import { type DeadlineSlot, type EvaluationView, calendarDate } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { nextStep } from './next-step';

interface ViewOptions {
  status: string;
  deadlines?: Partial<Record<DeadlineSlot, string | null>>;
  criteria?: string[];
  ratings?: Record<string, number>;
  developmentConclusions?: string;
}

function view(options: ViewOptions): EvaluationView {
  return {
    status: options.status,
    sheet: {
      content: {
        partTwo: {
          ratings: options.ratings ?? {},
          developmentConclusions: options.developmentConclusions ?? '',
        },
      },
    },
    criteria: options.criteria ?? [],
    deadlines: Object.entries(options.deadlines ?? {}).map(([slot, dueOn]) => ({
      slot,
      windowStart: '2026-01-01',
      dueOn: dueOn ? calendarDate(dueOn) : null,
      suspendedSince: null,
    })),
  } as unknown as EvaluationView;
}

describe('nextStep', () => {
  it('asks to set criteria at the starting interview', () => {
    expect(
      nextStep(view({ status: 'criteria', deadlines: { startingInterview: '2026-12-18' } })),
    ).toEqual({
      stage: 'Kryteria',
      action: 'Ustal kryteria na rozmowie rozpoczynającej',
      owner: 'evaluator',
      dueOn: '2026-12-18',
      missingFields: null,
    });
  });

  it('prefers the starting interview after a negative evaluation', () => {
    const step = nextStep(
      view({
        status: 'criteria',
        deadlines: {
          startingInterview: '2026-12-18',
          startingInterviewAfterNegative: '2027-01-10',
        },
      }),
    );
    expect(step?.dueOn).toBe('2027-01-10');
  });

  it('skips deadlines without a date', () => {
    const step = nextStep(
      view({
        status: 'criteria',
        deadlines: { startingInterviewAfterNegative: null, startingInterview: '2026-12-18' },
      }),
    );
    expect(step?.dueOn).toBe('2026-12-18');
  });

  it('asks for the part one signature', () => {
    expect(nextStep(view({ status: 'criteria_awaiting_signature' }))).toMatchObject({
      stage: 'Podpis części I',
      action: 'Odnotuj podpis części I przez ocenianego',
      owner: 'evaluator',
    });
  });

  it('asks for the appraisal interview in the period, by priority of deadlines', () => {
    const deadlines = {
      evaluationDeadline: '2027-03-01',
      reevaluationAfterNegative: '2027-02-01',
      evaluationOnPositionChange: '2027-01-01',
    };
    const first = nextStep(view({ status: 'period', deadlines }));
    expect(first).toMatchObject({
      stage: 'Okres oceny',
      action: 'Odnotuj rozmowę oceniającą',
      owner: 'evaluator',
      dueOn: '2027-01-01',
    });
    const withoutFirst = { ...deadlines, evaluationOnPositionChange: null };
    expect(nextStep(view({ status: 'period', deadlines: withoutFirst }))?.dueOn).toBe('2027-02-01');
    const onlyLast = { ...withoutFirst, reevaluationAfterNegative: null };
    expect(nextStep(view({ status: 'period', deadlines: onlyLast }))?.dueOn).toBe('2027-03-01');
  });

  describe('interview', () => {
    const criteria = ['a', 'b'];

    it('asks for missing ratings', () => {
      const step = nextStep(view({ status: 'interview', criteria, ratings: { a: 5 } }));
      expect(step).toMatchObject({
        stage: 'Część II',
        action: 'Uzupełnij oceny cząstkowe w części II',
        owner: 'evaluator',
      });
    });

    it.each(['', '   '])('asks for conclusions when they are %j', (developmentConclusions) => {
      const step = nextStep(
        view({ status: 'interview', criteria, ratings: { a: 5, b: 7 }, developmentConclusions }),
      );
      expect(step?.action).toBe('Wpisz wnioski do IPRZ i zatwierdź ocenę');
    });

    it('asks to review and approve when complete', () => {
      const step = nextStep(
        view({
          status: 'interview',
          criteria,
          ratings: { a: 5, b: 7 },
          developmentConclusions: 'Szkolenie',
        }),
      );
      expect(step?.action).toBe('Sprawdź i zatwierdź ocenę');
    });

    it('counts missing partial ratings and empty conclusions as missing fields', () => {
      expect(nextStep(view({ status: 'interview', criteria }))?.missingFields).toBe(3);
      expect(
        nextStep(
          view({
            status: 'interview',
            criteria,
            ratings: { a: 5 },
            developmentConclusions: 'Kurs',
          }),
        )?.missingFields,
      ).toBe(1);
      expect(
        nextStep(view({ status: 'interview', criteria, ratings: { a: 5, b: 7 } }))?.missingFields,
      ).toBe(1);
      expect(
        nextStep(
          view({
            status: 'interview',
            criteria,
            ratings: { a: 5, b: 7 },
            developmentConclusions: 'Szkolenie',
          }),
        )?.missingFields,
      ).toBe(0);
    });

    it('has no missing fields outside the interview', () => {
      expect(nextStep(view({ status: 'period' }))?.missingFields).toBeNull();
    });

    it('keeps the deadlines of the period, by the same priority', () => {
      const deadlines = {
        evaluationDeadline: '2027-03-01',
        reevaluationAfterNegative: '2027-02-01',
        evaluationOnPositionChange: '2027-01-01',
      };
      expect(nextStep(view({ status: 'interview', criteria, deadlines }))?.dueOn).toBe(
        '2027-01-01',
      );
      expect(
        nextStep(view({ status: 'interview', deadlines: { evaluationDeadline: '2027-03-01' } }))
          ?.dueOn,
      ).toBe('2027-03-01');
      expect(nextStep(view({ status: 'interview' }))?.dueOn).toBeNull();
    });
  });

  it('asks to note the acquaintance for a drafted evaluation', () => {
    expect(nextStep(view({ status: 'drafted' }))).toEqual({
      stage: 'Zapoznanie',
      action: 'Odnotuj zapoznanie z oceną albo odmowę podpisu',
      owner: 'evaluator',
      dueOn: null,
      missingFields: null,
    });
  });

  it('waits for the objection period after delivery', () => {
    expect(nextStep(view({ status: 'delivered', deadlines: { objection: '2026-12-05' } }))).toEqual(
      {
        stage: 'Czas na sprzeciw',
        action: 'Czas na sprzeciw, potem ocena zamknie się sama',
        owner: 'nobody',
        dueOn: '2026-12-05',
        missingFields: null,
      },
    );
  });

  it('leaves the objection to HR', () => {
    expect(
      nextStep(view({ status: 'objection', deadlines: { objectionDecision: '2026-12-12' } })),
    ).toEqual({
      stage: 'Sprzeciw',
      action: 'Kadry rozpatrują sprzeciw',
      owner: 'hr',
      dueOn: '2026-12-12',
      missingFields: null,
    });
  });

  it.each(['closed', 'interrupted'])('has no step for %s', (status) => {
    expect(nextStep(view({ status }))).toBeNull();
  });
});
