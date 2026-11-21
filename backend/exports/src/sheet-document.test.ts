import { calendarDate } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { ExportError } from './errors';
import { buildSheetDocument, previousEvaluation } from './sheet-document';
import {
  EVALUATOR_ACCOUNT,
  HR_ACCOUNT,
  approval,
  makeSource,
  regulation2016,
  sheetContent,
} from './test-fixtures';

const build = (spec: Parameters<typeof makeSource>[0] = {}, version?: number) =>
  buildSheetDocument(makeSource(spec), {
    signatureBox: false,
    ...(version === undefined ? {} : { version }),
  });

describe('buildSheetDocument', () => {
  it('sheet C lists mandatory criteria by name', () => {
    const document = build();
    expect(document.partOne.mandatoryCriteria).toEqual([
      'Wykorzystywanie wiedzy i doskonalenie zawodowe',
      'Rzetelność',
      'Organizacja pracy i orientacja na osiąganie celów',
      'Współpraca',
      'Komunikacja',
    ]);
    expect(document.partTwo.criteria.map((row) => row.name)).toEqual(
      document.partOne.mandatoryCriteria,
    );
    expect(document.title).toBe(
      'ARKUSZ C. OCENA OKRESOWA URZĘDNIKA SŁUŻBY CYWILNEJ LUB PRACOWNIKA SŁUŻBY CYWILNEJ',
    );
  });

  it('rating 5 marks the meets column', () => {
    const document = build();
    expect(document.partTwo.criteria.every((row) => row.markedCode === 'meets')).toBe(true);
    expect(document.partTwo.scale.map((column) => column.points)).toEqual([1, 3, 5, 7, 9]);
  });

  it('mean 4.6 marks the band above 4 up to 6', () => {
    const document = build({ points: [5, 5, 5, 5, 3] });
    expect(document.partTwo.mean).toBeCloseTo(4.6);
    const marked = document.partTwo.bands.filter((band) => band.marked);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toMatchObject({
      code: 'meets',
      range: 'powyżej 4 punktów do 6 punktów',
    });
    expect(document.partTwo.bands[0]?.range).toBe('od 1 punktu do 2 punktów');
    expect(document.partTwo.outcome).toBe('positive');
  });

  it('employee gets not applicable and no part three', () => {
    const document = build({
      serviceStatus: 'employee',
      gradeRequest: { requestedGrade: 6, motivation: 'Wysokie wyniki' },
    });
    expect(document.partTwo.gradeRequestAnswer).toBe('not_applicable');
    expect(document.partThree).toBeNull();
  });

  it('civil servant with grade request gets part three', () => {
    const document = build({
      gradeRequest: { requestedGrade: 6, motivation: 'Wysokie wyniki' },
    });
    expect(document.partTwo.gradeRequestAnswer).toBe('yes');
    expect(document.partThree).toMatchObject({
      lastName: 'Kowalska',
      appointmentYear: 2019,
      currentGrade: 5,
      requestedGrade: 6,
      motivation: 'Wysokie wyniki',
    });
    expect(build().partTwo.gradeRequestAnswer).toBe('no');
    expect(build().partThree).toBeNull();
  });

  it('sheet A has no org unit fields and objection addressee from rules', () => {
    const addressee = regulation2016.sheets.find((sheet) => sheet.id === 'A')?.objectionAddressee;
    const document = build({
      sheetId: 'A',
      points: [5, 5, 5, 5, 5, 5],
      objectionAddressee: addressee ?? null,
    });
    expect(document.partOne.orgUnitFields).toBe(false);
    expect(document.partOne.mandatoryCriteria).toHaveLength(6);
    expect(document.partTwo.objectionNotice).toContain(addressee ?? 'missing');
    expect(document.footnotes.objectionAddressee).toBeUndefined();
    const sheetC = build();
    expect(sheetC.partOne.orgUnitFields).toBe(true);
    expect(sheetC.partTwo.objectionNotice).toContain('dyrektora generalnego urzędu');
    expect(sheetC.footnotes.objectionAddressee).toContain('kierownika tego urzędu');
  });

  it('negative sheet B with three additional criteria marks far below and requires justification', () => {
    const document = build({
      sheetId: 'B',
      additional: ['negotiation', 'creativity', 'public-speaking'],
      points: [1, 5, 5, 5, 5, 5, 5, 5],
      justification: 'Brak decyzyjności.',
    });
    expect(document.partTwo.criteria).toHaveLength(8);
    expect(
      document.partTwo.criteria.filter((row) => row.additional).map((row) => row.name),
    ).toEqual(['Negocjowanie', 'Kreatywność', 'Wystąpienia publiczne']);
    expect(document.partTwo.criteria[0]?.markedCode).toBe('far-below');
    expect(document.partTwo.outcome).toBe('negative');
    expect(document.partTwo.justificationRequired).toBe(true);
    expect(document.partTwo.justification).toBe('Brak decyzyjności.');
    expect(document.partOne.additionalCriteria).toEqual([
      'Negocjowanie',
      'Kreatywność',
      'Wystąpienia publiczne',
    ]);
  });

  it('draft version is marked as draft', () => {
    expect(build({ state: 'draft', status: 'interview' }).isDraft).toBe(true);
    expect(build().isDraft).toBe(false);
  });

  it('approvals carry account name, time and sha for that version only', () => {
    const document = build({
      events: [
        approval('sheet_approved', 1, '2026-06-15', { place: 'Warszawa' }),
        approval('acquainted', 2, '2026-06-20', {}, HR_ACCOUNT),
      ],
    });
    expect(document.approvals).toHaveLength(1);
    expect(document.approvals[0]).toMatchObject({
      label: 'Zatwierdzenie oceny przez oceniającego',
      occurredOn: '2026-06-15',
      recordedBy: 'Jan Nowak',
      sheetVersion: 1,
      sheetSha256: '1'.repeat(64),
      place: 'Warszawa',
    });
    expect(document.placeAndDate.partTwoEvaluator).toEqual({
      place: 'Warszawa',
      occurredOn: '2026-06-15',
    });
    const unknown = build({
      events: [approval('sheet_approved', 1, '2026-06-15', {}, 'unknown-account')],
    });
    expect(unknown.approvals[0]?.recordedBy).toBe('unknown-account');
  });

  it('refused signature shows note, witnesses and place', () => {
    const document = build({
      events: [
        approval('signature_refused', 1, '2026-06-20', {
          place: 'Kraków',
          refusalNote: 'Oceniany odmówił podpisu.',
          witnesses: ['Anna Świadek', 'Piotr Drugi'],
        }),
      ],
    });
    expect(document.approvals[0]).toMatchObject({
      kind: 'signature_refused',
      place: 'Kraków',
      refusalNote: 'Oceniany odmówił podpisu.',
      witnesses: ['Anna Świadek', 'Piotr Drugi'],
    });
    expect(document.placeAndDate.partTwoEvaluated?.place).toBe('Kraków');
  });

  it('older version is scored from its own content', () => {
    const old = sheetContent({ points: [9, 9, 9, 9, 9] });
    const current = sheetContent({ points: [1, 1, 1, 1, 1] });
    const source = makeSource({
      currentVersion: 2,
      versions: [
        {
          version: 1,
          state: 'superseded',
          content: old,
          reason: null,
          createdBy: EVALUATOR_ACCOUNT,
          createdAt: '2026-06-15T08:00:00.000Z',
        },
        {
          version: 2,
          state: 'locked',
          content: current,
          reason: 'Po sprzeciwie',
          createdBy: HR_ACCOUNT,
          createdAt: '2026-06-30T08:00:00.000Z',
        },
      ],
    });
    const first = buildSheetDocument(source, { signatureBox: false, version: 1 });
    expect(first.partTwo.mean).toBe(9);
    expect(first.partTwo.levelCode).toBe('far-above');
    expect(first.version).toEqual({ number: 1, state: 'superseded', reason: null });
    const latest = buildSheetDocument(source, { signatureBox: false });
    expect(latest.version.number).toBe(2);
    expect(latest.version.reason).toBe('Po sprzeciwie');
    expect(() => buildSheetDocument(source, { signatureBox: false, version: 7 })).toThrow(
      ExportError,
    );
  });

  it('another regulation version is refused', () => {
    const source = { ...makeSource(), regulation: { ...regulation2016, id: 'regulation-2030' } };
    expect(() => buildSheetDocument(source, { signatureBox: false })).toThrow(
      expect.objectContaining({ code: 'unsupported_regulation' }) as Error,
    );
  });
});

describe('previousEvaluation', () => {
  const entry = (drafted: string) => ({
    drafted: calendarDate(drafted),
    levelCode: 'meets',
    outcome: 'positive' as const,
    acquaintedOn: null,
  });

  it('picks the last entry drafted on or before the cycle start', () => {
    const history = [entry('2022-01-10'), entry('2024-02-01'), entry('2026-06-01')];
    expect(previousEvaluation(history, calendarDate('2025-06-12'))?.drafted).toBe('2024-02-01');
    expect(previousEvaluation(history, calendarDate('2021-01-01'))).toBeNull();
  });
});
