import { calendarDate } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { ExportError } from './errors';
import { sheetTemplateData } from './pdf/sheet-template';
import { buildSheetDocument, previousEvaluation, signatureStatus } from './sheet-document';
import {
  EVALUATOR_ACCOUNT,
  HR_ACCOUNT,
  approval,
  event,
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
    expect(document.placeAndDate.partTwoEvaluator).toMatchObject({
      place: 'Warszawa',
      occurredOn: '2026-06-15',
      kind: 'sheet_approved',
      sheetVersion: 1,
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

  it('refused signature line prints the refusal, never an approval', () => {
    const document = build({
      events: [
        approval('sheet_approved', 1, '2026-06-15'),
        approval('signature_refused', 1, '2026-06-20', {
          place: 'Kraków',
          refusalNote: 'Oceniany odmówił podpisu',
          witnesses: ['Anna Świadek', 'Piotr Drugi'],
        }),
      ],
    });
    const line = sheetTemplateData(document).placeAndDate.partTwoEvaluated;
    expect(line).toEqual({
      place: 'Kraków',
      date: '20.06.2026',
      status:
        'odmowa podpisu. Notatka o odmowie podpisu: Oceniany odmówił podpisu. Świadkowie: Anna Świadek, Piotr Drugi.',
    });
    expect(line.status).not.toContain('zatwierdzono');
  });

  it('confirmations of the evaluated person are recorded, not approved by them', () => {
    const document = build({
      events: [
        approval('part_one_approved', 1, '2025-06-12'),
        approval('part_one_signed', 1, '2025-06-12'),
      ],
    });
    expect(signatureStatus(document.placeAndDate.partOneEvaluated, 1, document.labels)).toBe(
      'odnotowano w systemie (Jan Nowak)',
    );
    expect(signatureStatus(document.placeAndDate.partOneEvaluator, 1, document.labels)).toBe(
      'zatwierdzono w systemie (Jan Nowak)',
    );
  });

  it('a version made by a correction keeps the approvals of earlier versions', () => {
    const versions = [1, 2].map((version) => ({
      version,
      state: version === 1 ? ('superseded' as const) : ('locked' as const),
      content: sheetContent(),
      reason: version === 1 ? null : 'Korekta',
      createdBy: HR_ACCOUNT,
      createdAt: `2026-07-0${String(version)}T08:00:00.000Z`,
    }));
    const document = buildSheetDocument(
      makeSource({
        currentVersion: 2,
        versions,
        events: [
          approval('part_one_approved', 1, '2025-06-12', { place: 'Warszawa' }),
          approval('part_one_signed', 1, '2025-06-12'),
          approval('sheet_approved', 1, '2026-06-15'),
          approval('acquainted', 1, '2026-06-20'),
          approval('correction', 2, '2026-07-02', { reason: 'Korekta' }, HR_ACCOUNT),
        ],
      }),
      { signatureBox: false },
    );
    expect(document.approvals.map((a) => [a.kind, a.sheetVersion])).toEqual([
      ['part_one_approved', 1],
      ['part_one_signed', 1],
      ['sheet_approved', 1],
      ['acquainted', 1],
      ['correction', 2],
    ]);
    const lines = sheetTemplateData(document).placeAndDate;
    expect(lines.partOneEvaluator.status).toBe('zatwierdzono w systemie (Jan Nowak, wersja 1)');
    expect(lines.partTwoEvaluated.status).toBe('odnotowano w systemie (Jan Nowak, wersja 1)');
    expect(lines.partOneEvaluator.place).toBe('Warszawa');
    expect(Object.values(lines).map((line) => line.status)).not.toContain('brak zatwierdzenia');
  });

  it('an acquaintance before a redraft does not sign the new sheet', () => {
    const document = buildSheetDocument(
      makeSource({
        currentVersion: 2,
        state: 'locked',
        events: [
          approval('sheet_approved', 1, '2026-06-15'),
          approval('acquainted', 1, '2026-06-20'),
          event({
            kind: 'objection_outcome',
            occurredOn: '2026-06-30',
            payload: { outcome: 'redraft', sheetVersion: 2, sheetSha256: '2'.repeat(64) },
          }),
          approval('sheet_approved', 2, '2026-07-10'),
        ],
      }),
      { signatureBox: false },
    );
    expect(document.placeAndDate.partTwoEvaluator).toMatchObject({
      occurredOn: '2026-07-10',
      sheetVersion: 2,
    });
    expect(document.placeAndDate.partTwoEvaluated).toBeNull();
  });

  it('part three prints the request sentence of the form', () => {
    const document = build({ gradeRequest: { requestedGrade: 6, motivation: 'Wysokie wyniki' } });
    expect(document.partThree?.requestSentence).toBe(
      'W związku z uzyskaniem przez Panią/Pana Zofia Kowalska pozytywnej oceny okresowej, na podstawie art. 89 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej wnioskuję o przyznanie szóstego stopnia służbowego.',
    );
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

  it('an office version cloned from the official regulation uses the root form texts', () => {
    const source = {
      ...makeSource(),
      regulation: { ...regulation2016, id: 'regulation-2016-local-1' },
    };
    expect(() => buildSheetDocument(source, { signatureBox: false, version: 1 })).not.toThrow();
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
