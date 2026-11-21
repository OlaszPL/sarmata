import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CalendarDate, calendarDate, sheetContentSchema } from '@sarmata/domain';
import {
  type Database,
  type Db,
  createNotificationDeliveryStore,
  createServiceClient,
} from '@sarmata/repositories';
import { ServiceError, servicesFor } from '@sarmata/services';
import { createClient } from '@supabase/supabase-js';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { exportsFor } from './index';

// The golden path of the jury demo, end to end, as the real demo accounts and through the public
// services only (RLS, triggers, the deadline engine, exports, statistics and the notification
// collector all apply). Run on a fresh `pnpm db:reset`, through `pnpm test:integration`. AI services
// are covered elsewhere, no AI call is made here.

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

async function signedIn(email: string): Promise<Db> {
  const db: Db = createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password: 'Haslo-Demo-2026' });
  if (error) throw error;
  return db;
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return calendarDate(moved.toISOString().slice(0, 10));
}

/** Text of a PDF through poppler, `null` when pdftotext is not installed (the PDF checks then skip). */
function pdfText(bytes: Uint8Array): string | null {
  const directory = mkdtempSync(join(tmpdir(), 'golden-path-'));
  try {
    const file = join(directory, 'sheet.pdf');
    writeFileSync(file, bytes);
    const result = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
    if (result.error !== undefined || result.status !== 0) return null;
    return result.stdout.replace(/\s+/g, ' ');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const unzipText = (bytes: Uint8Array, name: string): string => {
  const entry = unzipSync(bytes)[name];
  if (entry === undefined) throw new Error(`${name} is missing in the archive`);
  return strFromU8(entry);
};

const today = calendarDate(new Date().toISOString().slice(0, 10));
const year = Number(today.slice(0, 4));

// Every date is relative to today, so the deadlines stay valid on any day of the run. Objection filing
// on day 3 is inside the 7 days from the first acquaintance, the second window runs from day 6.
const day = (offset: number): CalendarDate => addDays(today, offset);

const FIRST_REFUSAL = 'Oceniany odmówił podpisu złotej ścieżki.';
const SECOND_REFUSAL = 'Oceniany ponownie odmówił podpisu po ponownym sporządzeniu.';
const JUSTIFICATION = 'Uzasadnienie złotej ścieżki: terminowo i rzetelnie.';
const UNIT = 'Wydział Złotej Ścieżki';

// Sheet C: five mandatory criteria in catalog order, then the one additional criterion.
const MANDATORY = [
  'knowledge-use',
  'reliability',
  'work-organization',
  'cooperation',
  'communication',
];
const ADDITIONAL = 'negotiation';
const ratings = Object.fromEntries(
  [...MANDATORY, ADDITIONAL].map((id, index) => [id, [7, 7, 7, 7, 7, 9][index] ?? 7]),
);

describe('golden path of the demo', () => {
  it('runs an evaluation from the first criterion to the closed case file', async () => {
    const evaluatorDb = await signedIn('oceniajacy@kropka.test');
    const hrDb = await signedIn('kadry@kropka.test');
    const evaluator = servicesFor(evaluatorDb);
    const hr = servicesFor(hrDb);

    const reportBefore = await hr.statistics.officeReport(year);

    // 1. The evaluator creates a civil servant, starts the evaluation and goes through the sheet.
    const employee = await evaluator.employees.create({
      firstName: 'Zofia',
      lastName: 'Ścieżkowska',
      positionTitle: 'Starszy specjalista',
      orgUnit: UNIT,
      serviceStatus: 'civil_servant',
      grade: 4,
      appointmentYear: 2015,
      gradeGrantedOn: '2020-01-01',
      employmentStart: '2014-03-01',
    });

    const started = await evaluator.evaluations.start({ employeeId: employee.id, today });
    const evaluationId = started.id;
    expect(started.status).toBe('criteria');
    expect(started.sheetId).toBe('C');

    const partOne = sheetContentSchema.parse({
      partOne: { additionalCriteria: [ADDITIONAL], dueOn: null },
      partTwo: started.sheet.content.partTwo,
    });
    await evaluator.evaluations.saveDraft(evaluationId, partOne);
    // The stored content round-trips through JSON into the same gate as the real approval.
    expect(await evaluator.evaluations.approvalIssues(evaluationId)).toEqual({
      stage: 'part_one',
      issues: [],
    });
    await evaluator.evaluations.transition(evaluationId, {
      type: 'approve_part_one',
      startingInterviewOn: today,
    });
    const signed = await evaluator.evaluations.transition(evaluationId, {
      type: 'record_part_one_signature',
      signedOn: today,
    });
    expect(signed.status).toBe('period');
    expect(signed.criteria).toContain(ADDITIONAL);

    // 4 (schedule). While the evaluation is open, hr sees it in the schedule.
    const schedule = await hr.statistics.schedule({ today });
    const scheduled = schedule.rows.find((row) => row.evaluationId === evaluationId);
    expect(scheduled).toMatchObject({
      lastName: 'Ścieżkowska',
      orgUnit: UNIT,
      status: 'period',
      overdue: false,
    });
    expect(schedule.summary.inProgress).toBeGreaterThanOrEqual(1);

    // 5. Notifications: the collector runs three days before the evaluation deadline, so the
    // evaluator gets a reminder (the deadline slot ends with the sheet approval).
    const evaluationDeadline = signed.deadlines.find(
      (slot) => slot.slot === 'evaluationDeadline',
    )?.dueOn;
    if (evaluationDeadline === null || evaluationDeadline === undefined) {
      throw new Error('The evaluation has no evaluation deadline');
    }
    const collector = createNotificationDeliveryStore(
      createServiceClient({ url: env('SUPABASE_URL'), secretKey: env('SUPABASE_SECRET_KEY') }),
    );
    expect((await collector.collect(addDays(evaluationDeadline, -3))).created).toBeGreaterThan(0);
    const evaluatorInbox = await evaluator.notifications.inbox({ limit: 200 });
    expect(evaluatorInbox).toContainEqual(
      expect.objectContaining({
        kind: 'deadline_reminder',
        evaluationId,
        slot: 'evaluationDeadline',
        dueOn: evaluationDeadline,
        leadDays: 3,
        status: 'open',
      }),
    );

    // Part two: ratings, justification, IPRZ conclusions and the Part III grade request.
    const content = sheetContentSchema.parse({
      partOne: partOne.partOne,
      partTwo: {
        ...partOne.partTwo,
        interviewOn: today,
        periodFrom: today,
        periodTo: today,
        ratings,
        justification: JUSTIFICATION,
        developmentConclusions: 'Szkolenie z negocjacji i mentoring w zespole.',
        gradeRequest: { requestedGrade: 5, motivation: 'Wzorowa współpraca i inicjatywa.' },
      },
    });
    await evaluator.evaluations.saveDraft(evaluationId, content);
    const interview = await evaluator.evaluations.transition(evaluationId, {
      type: 'record_evaluation_interview',
      heldOn: today,
    });
    expect(interview.status).toBe('interview');
    expect(interview.score.complete).toBe(true);
    const levelCode = interview.score.levelCode;
    expect(levelCode).not.toBeNull();
    expect(interview.score.outcome).toBe('positive');

    const drafted = await evaluator.evaluations.transition(evaluationId, {
      type: 'approve_sheet',
      draftedOn: today,
    });
    expect(drafted.status).toBe('drafted');
    const refused = await evaluator.evaluations.transition(evaluationId, {
      type: 'record_acquaintance',
      acquaintedOn: today,
      signatureRefused: true,
      refusalNote: FIRST_REFUSAL,
    });
    expect(refused.status).toBe('delivered');
    const objectionDue = refused.deadlines.find((slot) => slot.slot === 'objection')?.dueOn;
    // Seven days, moved to the next working day when the last one is a day off (Kodeks cywilny).
    if (objectionDue === undefined || objectionDue === null)
      throw new Error('No objection deadline');
    expect(objectionDue >= day(7) && objectionDue <= day(10)).toBe(true);

    // 2. Hr files the objection inside the 7 days. A late one is refused.
    await expect(
      hr.evaluations.transition(evaluationId, {
        type: 'file_objection',
        filedOn: addDays(objectionDue, 1),
      }),
    ).rejects.toMatchObject({ code: 'objection_late' });
    const objected = await hr.evaluations.transition(evaluationId, {
      type: 'file_objection',
      filedOn: day(3),
    });
    expect(objected.status).toBe('objection');

    // The objection gives hr a decision task (14 days for the director general), not the evaluator.
    await collector.collect(day(3));
    const hrInbox = await hr.notifications.inbox({ limit: 200 });
    const objectionTask = hrInbox.find(
      (item) => item.evaluationId === evaluationId && item.kind === 'objection_decision',
    );
    expect(objectionTask).toMatchObject({ category: 'task', status: 'open' });
    const evaluatorAfter = await evaluator.notifications.inbox({ limit: 200 });
    expect(evaluatorAfter.some((item) => item.kind === 'objection_decision')).toBe(false);

    // Hr decides the objection: redraft. The evaluator draws the sheet up again.
    const redrafted = await hr.evaluations.decideObjection(evaluationId, {
      outcome: 'redraft',
      decidedOn: day(5),
    });
    expect(redrafted.status).toBe('interview');
    expect(redrafted.sheet.version).toBe(2);
    expect(redrafted.sheet.state).toBe('draft');
    expect(redrafted.sheet.content).toEqual(content);

    const redrawn = await evaluator.evaluations.transition(evaluationId, {
      type: 'approve_sheet',
      draftedOn: day(6),
    });
    expect(redrawn.status).toBe('drafted');
    const delivered = await evaluator.evaluations.transition(evaluationId, {
      type: 'record_acquaintance',
      acquaintedOn: day(6),
      signatureRefused: true,
      refusalNote: SECOND_REFUSAL,
    });
    expect(delivered.status).toBe('delivered');
    const secondDue = delivered.deadlines.find((slot) => slot.slot === 'objection')?.dueOn;
    if (secondDue === undefined || secondDue === null)
      throw new Error('No second objection deadline');
    expect(secondDue >= day(13) && secondDue <= day(16)).toBe(true);

    // The window is still open on its last day, the evaluation closes the day after.
    await expect(
      evaluator.evaluations.transition(evaluationId, {
        type: 'close_after_objection_window',
        closedOn: secondDue,
      }),
    ).rejects.toMatchObject({ code: 'approval_blocked' });
    const closed = await evaluator.evaluations.transition(evaluationId, {
      type: 'close_after_objection_window',
      closedOn: addDays(secondDue, 1),
    });
    expect(closed.status).toBe('closed');
    expect(closed.events.map((event) => event.kind)).toEqual([
      'created',
      'part_one_approved',
      'part_one_signed',
      'evaluation_interview_held',
      'sheet_approved',
      'signature_refused',
      'objection_filed',
      'objection_outcome',
      'sheet_approved',
      'signature_refused',
      'closed',
    ]);

    // The objection task ends with the objection: the next collector run resolves it.
    await collector.collect(addDays(secondDue, 1));
    const hrAfter = await hr.notifications.inbox({ limit: 200 });
    expect(
      hrAfter.find(
        (item) => item.evaluationId === evaluationId && item.kind === 'objection_decision',
      ),
    ).toMatchObject({ status: 'resolved' });

    // 3. Exports as the evaluator, through the same RLS as the download route.
    const exporter = exportsFor(evaluatorDb);
    const pdf = await exporter.export(evaluationId, { kind: 'sheet_pdf' });
    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(pdf.bytes.subarray(0, 4)).toString('latin1')).toBe('%PDF');

    const docx = await exporter.export(evaluationId, { kind: 'sheet_docx' });
    expect(docx.bytes.length).toBeGreaterThan(1000);
    const docxText = unzipText(docx.bytes, 'word/document.xml');
    expect(docxText).toContain(SECOND_REFUSAL);
    expect(docxText).toContain('Ścieżkowska');
    expect(docxText).toContain(JUSTIFICATION);

    const currentText = pdfText(pdf.bytes);
    if (currentText !== null) {
      expect(currentText).toContain(SECOND_REFUSAL);
      expect(currentText).toContain('Ścieżkowska');
      // Part III: the grade request sentence and its intro.
      expect(currentText).toContain('WNIOSEK O PRZYZNANIE URZĘDNIKOWI SŁUŻBY CYWILNEJ');
      expect(currentText).toContain('na podstawie art. 89 ust. 1 ustawy');
      expect(currentText).toContain('Wzorowa współpraca i inicjatywa.');
    }

    const caseFile = await exporter.export(evaluationId, { kind: 'case_file' });
    const files = unzipSync(caseFile.bytes);
    expect(Object.keys(files).sort()).toEqual([
      'arkusz.pdf',
      'dziennik-zdarzen.csv',
      'dziennik-zdarzen.pdf',
      'manifest.json',
      'wersje/arkusz-v1.pdf',
      'wersje/arkusz-v2.pdf',
    ]);
    const log = unzipText(caseFile.bytes, 'dziennik-zdarzen.csv');
    expect(log).toContain(FIRST_REFUSAL);
    expect(log).toContain(SECOND_REFUSAL);
    for (const kind of ['objection_filed', 'objection_outcome', 'closed', 'sheet_approved']) {
      expect(log).toContain(kind);
    }
    const firstVersionText = pdfText(files['wersje/arkusz-v1.pdf'] ?? new Uint8Array());
    if (firstVersionText !== null) expect(firstVersionText).toContain(FIRST_REFUSAL);

    // 4. Statistics: the closed evaluation counts in the year of its last sheet approval.
    const reportAfter = await hr.statistics.officeReport(year);
    expect(reportAfter.total).toBe(reportBefore.total + 1);
    const levelCount = (report: typeof reportAfter, code: string) =>
      report.levels.find((level) => level.code === code)?.count ?? 0;
    expect(levelCount(reportAfter, levelCode ?? '')).toBe(
      levelCount(reportBefore, levelCode ?? '') + 1,
    );
    const unit = reportAfter.byUnit.find((entry) => entry.orgUnit === UNIT);
    expect(unit?.total).toBe(1);
    expect(unit?.levels[levelCode ?? '']).toBe(1);
    const answer = (report: typeof reportAfter, label: string) =>
      report.dscOck.find((entry) => entry.label === label)?.value ?? 0;
    // A redraft counts as an upheld objection, nothing is pending or rejected from this evaluation.
    for (const [label, delta] of [
      ['Sprzeciwy uwzględnione', 1],
      ['Sprzeciwy nieuwzględnione', 0],
      ['Sprzeciwy nierozpatrzone', 0],
      ['Sprzeciwy ogółem', 1],
      ['Wnioski o kolejny stopień służbowy (art. 89 ust. 1)', 1],
    ] as const) {
      expect(answer(reportAfter, label) - answer(reportBefore, label), label).toBe(delta);
    }
    expect(answer(reportAfter, 'Oceny negatywne') - answer(reportBefore, 'Oceny negatywne')).toBe(
      0,
    );

    // 6. Notes: the guard asks for a rewrite, then saves after the confirmation.
    const body = 'Pracownica jest w ciąży i choruje na cukrzycę.';
    const draft = {
      employeeId: employee.id,
      kind: 'observation',
      occurredOn: today,
      sign: 'minus',
      body,
    } as const;
    const checked = await evaluator.notes.check({ employeeId: employee.id, body });
    expect(checked.keywordWarnings.map((warning) => warning.category)).toEqual(
      expect.arrayContaining(['health', 'diagnosis']),
    );
    // The worker does not run in this test, so the AI run stays pending.
    expect(checked.ai.status).toBe('pending');
    if (checked.ai.status === 'pending') {
      expect((await evaluator.notes.checkResult(checked.ai.runId)).status).toBe('pending');
    }
    const refusedNote = await evaluator.notes.create(draft).catch((error: unknown) => error);
    expect(refusedNote).toBeInstanceOf(ServiceError);
    expect(refusedNote).toMatchObject({ code: 'sensitive_data' });
    const warned = (refusedNote as ServiceError).details as { category: string }[];
    expect(warned.map((warning) => warning.category)).toEqual(
      expect.arrayContaining(['health', 'diagnosis']),
    );
    expect(await evaluator.notes.listForEmployee(employee.id)).toHaveLength(0);

    const saved = await evaluator.notes.create(draft, { acceptWarnings: true });
    expect(saved.body).toBe(body);
    const listed = await evaluator.notes.listForEmployee(employee.id);
    expect(listed.map((note) => note.id)).toEqual([saved.id]);

    // 7. The author's own list holds the note, the hr list (hr reads all notes) does not.
    expect((await evaluator.notes.listMine()).map((note) => note.id)).toContain(saved.id);
    expect((await hr.notes.listMine()).map((note) => note.id)).not.toContain(saved.id);

    // 8. The pinned regulation document and the approval preview of a closed evaluation.
    const pinned = await evaluator.regulations.forEvaluation(evaluationId);
    expect(pinned.id).toBe(started.regulationId);
    expect(await evaluator.evaluations.approvalIssues(evaluationId)).toEqual({
      stage: null,
      issues: [],
    });
  });
});
