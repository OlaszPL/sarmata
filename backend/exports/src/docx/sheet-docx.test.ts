import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PDF_FONT_FAMILY } from '../pdf/font';
import { buildSheetDocument } from '../sheet-document';
import { approval, makeSource } from '../test-fixtures';
import { renderSheetDocx } from './sheet-docx';

async function docx(spec: Parameters<typeof makeSource>[0] = {}, signatureBox = false) {
  const bytes = await renderSheetDocx(buildSheetDocument(makeSource(spec), { signatureBox }));
  const files = unzipSync(bytes);
  const read = (name: string) => {
    const file = files[name];
    return file === undefined ? '' : strFromU8(file);
  };
  return { files, read, document: read('word/document.xml') };
}

/** Texts of the cells per row: `[[cell, cell], ...]`. */
function rows(xml: string): string[][] {
  return [...xml.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((row) =>
    [...row[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((cell) =>
      [...cell[0].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((text) => text[1]).join(''),
    ),
  );
}

describe('sheet DOCX', () => {
  it('docx lists criteria names', async () => {
    const { document } = await docx();
    for (const name of [
      'Wykorzystywanie wiedzy i doskonalenie zawodowe',
      'Rzetelność',
      'Organizacja pracy i orientacja na osiąganie celów',
      'Współpraca',
      'Komunikacja',
    ]) {
      expect(document).toContain(name);
    }
  });

  it('docx marks rating with X in the right column', async () => {
    const { document } = await docx({ points: [1, 3, 5, 7, 9] });
    const marks = rows(document).filter(
      (row) =>
        row.length === 6 &&
        /^Wykorzystywanie|^Rzetelność|^Organizacja|^Współpraca|^Komunikacja/.test(row[0] ?? ''),
    );
    expect(marks).toHaveLength(5);
    marks.forEach((row, index) => {
      const column = row.slice(1).indexOf('X');
      expect(column).toBe(index);
    });
  });

  it('docx sets Polish language and title', async () => {
    const { read } = await docx();
    expect(read('word/styles.xml')).toContain('w:lang w:val="pl-PL"');
    expect(read('word/styles.xml')).toContain(PDF_FONT_FAMILY);
    expect(read('docProps/core.xml')).toContain(
      'ARKUSZ C. OCENA OKRESOWA URZĘDNIKA SŁUŻBY CYWILNEJ LUB PRACOWNIKA SŁUŻBY CYWILNEJ',
    );
    expect(read('docProps/core.xml')).toContain('Urząd Testów i Badań');
  });

  it('docx has approvals table', async () => {
    const { document, read } = await docx({
      events: [approval('sheet_approved', 1, '2026-06-15', { place: 'Warszawa' })],
    });
    const approvals = rows(document).find(
      (row) => row[0] === 'Zatwierdzenie oceny przez oceniającego',
    );
    expect(approvals).toEqual([
      'Zatwierdzenie oceny przez oceniającego',
      '15.06.2026',
      '15.06.2026 11:30',
      'Jan Nowak',
      '1',
      '1'.repeat(64),
    ]);
    expect(document).toContain('<w:tblHeader');
    expect(read('word/footnotes.xml')).toContain('Należy wstawić znak');
  });

  it('docx prints the part three sentence once and the refusal on the signature line', async () => {
    const { document } = await docx({
      gradeRequest: { requestedGrade: 6, motivation: 'Wysokie wyniki' },
      events: [
        approval('sheet_approved', 1, '2026-06-15'),
        approval('signature_refused', 1, '2026-06-20', { refusalNote: 'Odmowa' }),
      ],
    });
    expect(document).toContain('wnioskuję o przyznanie szóstego stopnia służbowego.');
    expect(document.match(/WNIOSEK O PRZYZNANIE URZĘDNIKOWI/g)).toHaveLength(1);
    expect(document).toContain(
      'podpis ocenianego: odmowa podpisu. Notatka o odmowie podpisu: Odmowa.',
    );
  });

  it('draft docx is marked as draft', async () => {
    const draft = await docx({ state: 'draft', status: 'interview' });
    const headers = Object.keys(draft.files).filter((name) => name.startsWith('word/header'));
    expect(headers.map((name) => draft.read(name)).join('')).toContain('PROJEKT');
    const locked = await docx();
    expect(Object.keys(locked.files).some((name) => name.startsWith('word/header'))).toBe(false);
  });
});
