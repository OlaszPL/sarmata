import { createHash } from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { eventLogCsv } from './case-file';
import { buildEventLog } from './event-log';
import { ExportError } from './errors';
import { type ExportSource } from './sheet-document';
import { createExportService } from './export-service';
import {
  EVALUATOR_ACCOUNT,
  HR_ACCOUNT,
  approval,
  event,
  makeSource,
  sheetContent,
} from './test-fixtures';

const now = new Date('2026-07-01T10:00:00.000Z');
const noticeEvent = event({
  id: '00000000-0000-4000-8000-0000000000aa',
  kind: 'term_changed',
  occurredOn: '2026-01-20',
  payload: { newDueOn: '2026-08-31', reason: 'requestOfEvaluated', noticeOn: '2026-01-20' },
});
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const latin = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

const serviceFor = (source: ExportSource | null) =>
  createExportService({ load: () => Promise.resolve(source), now: () => now });

/** Evaluation after an objection decided as `changed`: version 1 superseded, version 2 locked. */
function afterChangedObjection(): ExportSource {
  return makeSource({
    currentVersion: 2,
    status: 'closed',
    events: [
      event({ kind: 'created', occurredOn: '2025-06-12' }),
      noticeEvent,
      approval('sheet_approved', 1, '2026-06-15', { place: 'Warszawa' }),
      approval('acquainted', 1, '2026-06-16', { place: 'Warszawa' }),
      event({ kind: 'objection_filed', occurredOn: '2026-06-20' }),
      approval('objection_outcome', 2, '2026-06-30', { outcome: 'changed' }, HR_ACCOUNT),
    ],
    versions: [
      {
        version: 1,
        state: 'superseded',
        content: sheetContent({ points: [5, 5, 5, 5, 3] }),
        reason: null,
        createdBy: EVALUATOR_ACCOUNT,
        createdAt: '2026-06-15T08:00:00.000Z',
      },
      {
        version: 2,
        state: 'locked',
        content: sheetContent({ points: [7, 7, 5, 7, 5] }),
        reason: 'Zmiana po sprzeciwie',
        createdBy: HR_ACCOUNT,
        createdAt: '2026-06-30T08:00:00.000Z',
      },
    ],
  });
}

describe('export service', () => {
  it('unknown evaluation fails not_found', async () => {
    await expect(serviceFor(null).export('x', { kind: 'sheet_pdf' })).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('term notice for a non term_changed event fails unknown_event', async () => {
    const source = makeSource({ events: [approval('sheet_approved', 1, '2026-06-15')] });
    const id = source.view.events[0]?.id ?? '';
    const promise = serviceFor(source).export('e', { kind: 'term_notice', eventId: id });
    await expect(promise).rejects.toBeInstanceOf(ExportError);
    await expect(promise).rejects.toMatchObject({ code: 'unknown_event' });
    await expect(
      serviceFor(source).export('e', { kind: 'term_notice', eventId: 'missing' }),
    ).rejects.toMatchObject({ code: 'unknown_event' });
  });

  it('sheet exports are named after the sheet, person and approval date', async () => {
    const source = makeSource({ events: [approval('sheet_approved', 1, '2026-06-15')] });
    const pdf = await serviceFor(source).export('e', { kind: 'sheet_pdf' });
    expect(pdf).toMatchObject({
      fileName: 'arkusz-C-Kowalska-Zofia-2026-06-15.pdf',
      contentType: 'application/pdf',
    });
    expect(latin(pdf.bytes).startsWith('%PDF')).toBe(true);
    const docx = await serviceFor(source).export('e', { kind: 'sheet_docx', signatureBox: true });
    expect(docx.fileName).toBe('arkusz-C-Kowalska-Zofia-2026-06-15.docx');
    expect(latin(docx.bytes).startsWith('PK')).toBe(true);
    const notice = await serviceFor(makeSource({ events: [noticeEvent] })).export('e', {
      kind: 'term_notice',
      eventId: noticeEvent.id,
    });
    expect(notice.fileName).toBe('zawiadomienie-zmiana-terminu-Kowalska-Zofia-2026-01-20.pdf');
  });

  it('draft sheet exports as PDF but not to EZD', async () => {
    const source = makeSource({ state: 'draft', status: 'interview' });
    const pdf = await serviceFor(source).export('e', { kind: 'sheet_pdf' });
    expect(latin(pdf.bytes).startsWith('%PDF')).toBe(true);
  });

  it('case file after changed objection holds both versions, log, notices and manifest', async () => {
    const file = await serviceFor(afterChangedObjection()).export('e', { kind: 'case_file' });
    expect(file.contentType).toBe('application/zip');
    expect(file.fileName).toBe('teczka-C-Kowalska-Zofia-2026-06-15.zip');
    const files = unzipSync(file.bytes);
    expect(Object.keys(files).sort()).toEqual([
      'arkusz.pdf',
      'dziennik-zdarzen.csv',
      'dziennik-zdarzen.pdf',
      'manifest.json',
      'wersje/arkusz-v1.pdf',
      'wersje/arkusz-v2.pdf',
      'zawiadomienia/zmiana-terminu-2026-01-20.pdf',
    ]);
    const manifest = JSON.parse(strFromU8(files['manifest.json'] ?? new Uint8Array())) as {
      files: { file: string; sha256: string; description: string }[];
    };
    expect(manifest.files.map((entry) => entry.file).sort()).toEqual(
      Object.keys(files)
        .filter((name) => name !== 'manifest.json')
        .sort(),
    );
    for (const entry of manifest.files) {
      expect(entry.sha256, entry.file).toBe(sha(files[entry.file] ?? new Uint8Array()));
      expect(entry.description).not.toBe('');
    }
    expect(
      Buffer.compare(
        Buffer.from(files['wersje/arkusz-v1.pdf'] ?? []),
        Buffer.from(files['wersje/arkusz-v2.pdf'] ?? []),
      ),
    ).not.toBe(0);
    const csv = strFromU8(files['dziennik-zdarzen.csv'] ?? new Uint8Array());
    expect(csv.split('\r\n')).toHaveLength(8);
    expect(csv).toContain('objection_outcome');
  });

  it('case file is identical for the same input', async () => {
    const first = await serviceFor(afterChangedObjection()).export('e', { kind: 'case_file' });
    const second = await serviceFor(afterChangedObjection()).export('e', { kind: 'case_file' });
    expect(sha(first.bytes)).toBe(sha(second.bytes));
  });

  it('ezd package of a draft fails not_exportable', async () => {
    const source = makeSource({ state: 'draft', status: 'interview' });
    await expect(serviceFor(source).export('e', { kind: 'ezd_package' })).rejects.toMatchObject({
      code: 'not_exportable',
    });
  });

  it('ezd package holds PDF/A and metadata with case mark', async () => {
    const source = makeSource({
      events: [approval('sheet_approved', 1, '2026-06-15'), noticeEvent],
    });
    const file = await serviceFor(source).export('e', {
      kind: 'ezd_package',
      caseMark: 'DOA.0110.3.2026',
    });
    expect(file.fileName).toBe('paczka-ezd-C-Kowalska-Zofia-2026-06-15.zip');
    const files = unzipSync(file.bytes);
    expect(Object.keys(files).sort()).toEqual([
      'arkusz.pdf',
      'metadane.xml',
      'zawiadomienia/zmiana-terminu-2026-01-20.pdf',
    ]);
    for (const name of ['arkusz.pdf', 'zawiadomienia/zmiana-terminu-2026-01-20.pdf']) {
      const pdf = latin(files[name] ?? new Uint8Array());
      expect(pdf, name).toMatch(/<pdfaid:part>2/);
      expect(pdf, name).toMatch(/<pdfaid:conformance>A/);
    }
    const xml = strFromU8(files['metadane.xml'] ?? new Uint8Array());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<grupowanie>DOA.0110.3.2026</grupowanie>');
    expect(xml).toContain('<jezyk>pol</jezyk>');
    expect(xml).toContain('<relacja rodzaj="zalacznik-do">arkusz.pdf</relacja>');
    expect(xml).toContain(`<sha256>${sha(files['arkusz.pdf'] ?? new Uint8Array())}</sha256>`);
    expect(xml).toContain(`<sheetSha256>${'1'.repeat(64)}</sheetSha256>`);
    expect(xml).toContain('<oceniajacy>Jan Nowak</oceniajacy>');
  });

  it('metadata xml escapes ampersand in office name', async () => {
    const source = makeSource({
      officeName: 'Urząd Zdrowia & Opieki <Testowej>',
      events: [approval('sheet_approved', 1, '2026-06-15')],
    });
    const file = await serviceFor(source).export('e', { kind: 'ezd_package' });
    const xml = strFromU8(unzipSync(file.bytes)['metadane.xml'] ?? new Uint8Array());
    expect(xml).toContain('<urzad>Urząd Zdrowia &amp; Opieki &lt;Testowej&gt;</urzad>');
    expect(xml).not.toContain('Zdrowia & Opieki');
    expect(xml).not.toContain('<grupowanie>');
  });
});

describe('event log csv', () => {
  it('quotes fields with commas and quotes', () => {
    const log = buildEventLog(
      makeSource({ events: [event({ kind: 'created', occurredOn: '2025-06-12' })] }),
    );
    const csv = eventLogCsv({
      ...log,
      rows: log.rows.map((row) => ({ ...row, recordedBy: 'Kowalski, "Jan"' })),
    });
    expect(csv.split('\r\n')[0]).toBe(
      'rodzaj,zdarzenie,data_zdarzenia,czas_wpisu,konto,wersja,sha256,szczegoly',
    );
    expect(csv).toContain('"Kowalski, ""Jan"""');
  });

  it('carries the details of each event', () => {
    const log = buildEventLog(
      makeSource({
        events: [
          approval('signature_refused', 1, '2026-06-20', {
            place: 'Kraków',
            refusalNote: 'Oceniany odmówił podpisu',
            witnesses: ['Anna Świadek'],
          }),
          event({
            kind: 'objection_outcome',
            occurredOn: '2026-06-30',
            payload: { outcome: 'changed', reason: 'objection', sheetVersion: 2 },
          }),
          event({
            kind: 'term_changed',
            occurredOn: '2026-05-01',
            payload: {
              newDueOn: '2026-07-01',
              reason: 'requestOfEvaluated',
              noticeOn: '2026-05-01',
            },
          }),
          event({
            kind: 'interrupted',
            occurredOn: '2026-07-02',
            payload: { reason: 'Rozwiązanie stosunku pracy' },
          }),
          event({
            kind: 'correction',
            occurredOn: '2026-07-03',
            payload: { reason: 'Literówka w uzasadnieniu' },
          }),
          event({
            kind: 'absence',
            occurredOn: '2026-04-01',
            payload: { absenceId: 'x', from: '2026-04-01', to: null },
          }),
        ],
      }),
    );
    const details = log.rows.map((row) => row.details);
    expect(details[0]).toBe(
      'Notatka o odmowie podpisu: Oceniany odmówił podpisu. Świadkowie: Anna Świadek. Miejscowość: Kraków.',
    );
    expect(details[1]).toContain('sprzeciw uwzględniony, ocena zmieniona');
    expect(details[2]).toBe(
      'Nowy termin: 01.07.2026. Przyczyna: wniosek ocenianego. Zawiadomienie z dnia: 01.05.2026.',
    );
    expect(details[3]).toBe('Przyczyna przerwania: Rozwiązanie stosunku pracy.');
    expect(details[4]).toBe('Powód korekty: Literówka w uzasadnieniu.');
    expect(details[5]).toBe('Nieobecność od: 01.04.2026, do: nie wpisano.');
    expect(eventLogCsv(log)).toContain('Przyczyna przerwania: Rozwiązanie stosunku pracy.');
  });
});
