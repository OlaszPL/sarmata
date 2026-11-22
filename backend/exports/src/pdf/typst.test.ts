import { readdirSync, readFileSync } from 'node:fs';
import { calendarDate } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { buildEventLog } from '../event-log';
import { buildNoticeDocument } from '../notice-document';
import { buildSheetDocument } from '../sheet-document';
import { approval, event, makeSource } from '../test-fixtures';
import { PDF_FONT_FAMILY } from './font';
import { renderEventLogPdf } from './event-log-template';
import { NOTICE_TEMPLATE, noticeTemplateData, renderNoticePdf } from './notice-template';
import { SHEET_TEMPLATE, renderSheetPdf, sheetTemplateData } from './sheet-template';
import { renderPdf } from './typst';

const createdAt = new Date('2026-06-15T10:00:00.000Z');
const ua = { standard: 'ua-1', createdAt } as const;
const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');
const fonts = (bytes: Uint8Array) =>
  [...text(bytes).matchAll(/\/BaseFont\s*\/[A-Z]{6}\+([A-Za-z0-9-]+)/g)].map((match) => match[1]);

const termChanged = event({
  id: '00000000-0000-4000-8000-0000000000aa',
  kind: 'term_changed',
  occurredOn: '2026-01-20',
  payload: { newDueOn: '2026-08-31', reason: 'evaluatorChange', noticeOn: '2026-01-20' },
});

describe('sheet PDF', () => {
  it('sheet A, B and C render as PDF/UA-1', () => {
    for (const spec of [
      { sheetId: 'A', points: [5, 7, 5, 5, 5, 9] },
      { sheetId: 'B', points: [5, 5, 5, 5, 5] },
      { sheetId: 'C', points: [5, 5, 5, 5, 5] },
    ] as const) {
      const document = buildSheetDocument(
        makeSource({
          ...spec,
          events: [
            approval('part_one_approved', 1, '2026-01-10', { place: 'Warszawa' }),
            approval('sheet_approved', 1, '2026-06-15', { place: 'Warszawa' }),
          ],
        }),
        { signatureBox: false },
      );
      const bytes = renderSheetPdf(document, ua);
      expect(text(bytes).startsWith('%PDF')).toBe(true);
      expect(text(bytes)).toContain('pdfuaid:part');
    }
  });

  it('negative sheet B with three additional criteria renders', () => {
    const document = buildSheetDocument(
      makeSource({
        sheetId: 'B',
        additional: ['negotiation', 'creativity', 'public-speaking'],
        points: [1, 5, 5, 5, 5, 5, 5, 5],
        justification: 'Brak decyzyjności w sprawach kadrowych.',
        events: [
          approval('signature_refused', 1, '2026-06-20', {
            place: 'Kraków',
            refusalNote: 'Osoba oceniana odmówiła podpisu.',
            witnesses: ['Anna Świadek'],
          }),
        ],
      }),
      { signatureBox: true },
    );
    expect(document.partTwo.outcome).toBe('negative');
    const bytes = renderSheetPdf(document, ua);
    expect(text(bytes)).toContain('pdfuaid:part');
  });

  it('draft sheet and a civil servant with part three render', () => {
    const document = buildSheetDocument(
      makeSource({
        state: 'draft',
        status: 'interview',
        gradeRequest: { requestedGrade: 6, motivation: 'Wysokie wyniki.' },
        history: [
          {
            drafted: calendarDate('2025-01-01'),
            levelCode: 'meets',
            outcome: 'positive',
            acquaintedOn: null,
          },
        ],
      }),
      { signatureBox: false },
    );
    expect(document.isDraft).toBe(true);
    expect(sheetTemplateData(document).isDraft).toBe(true);
    expect(text(renderSheetPdf(document, ua))).toContain('pdfuaid:part');
  });

  it('same input renders identical bytes', () => {
    const document = buildSheetDocument(makeSource(), { signatureBox: false });
    const first = renderSheetPdf(document, ua);
    const second = renderSheetPdf(document, ua);
    expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
  });

  it('templates take the font from data', () => {
    const data = sheetTemplateData(buildSheetDocument(makeSource(), { signatureBox: false }));
    const base = fonts(renderPdf(SHEET_TEMPLATE, data, ua));
    const other = fonts(
      renderPdf(SHEET_TEMPLATE, { ...data, fontFamily: 'New Computer Modern' }, ua),
    );
    expect(base.length).toBeGreaterThan(0);
    expect(base.every((name) => name?.startsWith('OpenSans'))).toBe(true);
    expect(other.length).toBeGreaterThan(0);
    expect(other.every((name) => name?.startsWith('NewCM'))).toBe(true);
    expect(PDF_FONT_FAMILY).toBe('Open Sans');
  });

  it('embeds Open Sans with Polish diacritics in PDF/UA and PDF/A renders', () => {
    const pangram = 'Zażółć gęślą jaźń, ĄĆĘŁŃÓŚŹŻ';
    for (const standard of ['ua-1', 'a-2a'] as const) {
      const bytes = renderPdf(
        '#let data = json(bytes(sys.inputs.data))\n#set document(title: "Test")\n#set text(font: data.fontFamily, lang: "pl")\n#data.body *#data.body*',
        { body: pangram },
        { standard, createdAt },
      );
      const names = fonts(bytes);
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((name) => name?.startsWith('OpenSans'))).toBe(true);
      expect(names.some((name) => name?.endsWith('-Bold'))).toBe(true);
      expect(text(bytes)).toContain(standard === 'ua-1' ? 'pdfuaid:part' : 'pdfaid:part');
    }
  });

  it('no template hard-codes a font name', () => {
    const directory = new URL('./', import.meta.url);
    const modules = readdirSync(directory).filter(
      (name) => name.endsWith('.ts') && name !== 'font.ts' && !name.endsWith('.test.ts'),
    );
    expect(modules).toContain('sheet-template.ts');
    for (const name of modules) {
      const source = readFileSync(new URL(name, directory), 'utf8');
      expect(source, name).not.toMatch(/font:\s*"/);
      expect(source, name).not.toMatch(
        /\b(Libertinus|Computer Modern|Helvetica|Arial|Times New Roman|Comic Sans|Calibri|Cambria|Carlito|Caladea|Arimo)\b/i,
      );
    }
  });

  it('a-2a render declares PDF/A part 2 conformance A', () => {
    const document = buildSheetDocument(makeSource(), { signatureBox: false });
    const bytes = text(renderSheetPdf(document, { standard: 'a-2a', createdAt }));
    expect(bytes).toMatch(/<pdfaid:part>2/);
    expect(bytes).toMatch(/<pdfaid:conformance>A/);
  });
});

describe('notice and event log PDF', () => {
  it('notice renders as PDF/UA-1', () => {
    const source = makeSource({ events: [termChanged] });
    const notice = buildNoticeDocument(source, termChanged.id, { signatureBox: true });
    expect(notice.reasonLabel).toBe('zmiana oceniającego');
    const bytes = renderNoticePdf(notice, ua);
    expect(text(bytes).startsWith('%PDF')).toBe(true);
    expect(text(bytes)).toContain('pdfuaid:part');
  });

  it('notice prints the place with the date and no internal instruction', () => {
    const source = { ...makeSource({ events: [termChanged] }), defaultPlace: 'Warszawa' };
    const notice = buildNoticeDocument(source, termChanged.id, { signatureBox: false });
    expect(noticeTemplateData(notice).dateLine).toBe('Warszawa, 20.01.2026');
    expect(NOTICE_TEMPLATE).not.toContain('copyNote');
    expect(JSON.stringify(noticeTemplateData(notice))).not.toContain('Kopię zawiadomienia');
  });

  it('event log renders', () => {
    const source = makeSource({
      events: [
        event({ kind: 'created', occurredOn: '2025-06-12' }),
        termChanged,
        approval('sheet_approved', 1, '2026-06-15'),
      ],
    });
    const log = buildEventLog(source);
    expect(log.rows.map((row) => row.kind)).toEqual(['created', 'term_changed', 'sheet_approved']);
    const bytes = renderEventLogPdf(log, ua);
    expect(text(bytes)).toContain('pdfuaid:part');
  });
});
