import { strToU8 } from 'fflate';
import { type PackageFile, noticePaths, sha256Hex, zipFiles } from './case-file';
import { ExportError } from './errors';
import { formatDate } from './format';
import { buildNoticeDocument } from './notice-document';
import { renderNoticePdf } from './pdf/notice-template';
import { renderSheetPdf } from './pdf/sheet-template';
import { buildSheetDocument, type ExportSource } from './sheet-document';

/** Escapes the five XML special characters. The metadata is built by hand, without a library. */
export function xmlEscape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

interface DocumentMetadata {
  readonly id: string;
  readonly file: string;
  readonly creator: string;
  readonly office: string;
  readonly title: string;
  readonly date: string;
  readonly type: string;
  readonly relation: { readonly kind: string; readonly target: string } | null;
  readonly description: string;
  readonly fileSha256: string;
  readonly sheetSha256: string;
}

const element = (name: string, value: string, indent: string): string =>
  `${indent}<${name}>${xmlEscape(value)}</${name}>`;

/**
 * Metadata of one document. The element set follows the metadata of a document in a case file of
 * the clerical instruction (zal. nr 1 cz. C to the regulation of 18 January 2011): identifier, creator,
 * title, date, format, access, type, grouping (case mark), relation, language, description. The tables
 * of that annex are images in the source PDF, so this is the minimal set agreed in plan B6, to be
 * checked against the annex by hand.
 */
function documentXml(meta: DocumentMetadata, caseMark: string | null): string {
  const i = '    ';
  const lines = [
    '  <dokument>',
    element('identyfikator', meta.id, i),
    `${i}<tworca>`,
    element('urzad', meta.office, `${i}  `),
    element('oceniajacy', meta.creator, `${i}  `),
    `${i}</tworca>`,
    element('tytul', meta.title, i),
    element('data', meta.date, i),
    element('format', 'application/pdf (PDF/A-2a)', i),
    element('dostep', 'dane osobowe, dostęp ograniczony do urzędu', i),
    element('typ', meta.type, i),
    ...(caseMark === null ? [] : [element('grupowanie', caseMark, i)]),
    ...(meta.relation === null
      ? []
      : [
          `${i}<relacja rodzaj="${xmlEscape(meta.relation.kind)}">${xmlEscape(meta.relation.target)}</relacja>`,
        ]),
    element('jezyk', 'pol', i),
    element('opis', meta.description, i),
    element('plik', meta.file, i),
    element('sha256', meta.fileSha256, i),
    element('sheetSha256', meta.sheetSha256, i),
    '  </dokument>',
  ];
  return lines.join('\n');
}

export function metadataXml(
  documents: readonly DocumentMetadata[],
  caseMark: string | null,
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<metadane>',
    ...documents.map((document) => documentXml(document, caseMark)),
    '</metadane>',
    '',
  ].join('\n');
}

/**
 * The package for a clerical (EZD) system: sheet and notices as PDF/A-2a plus `metadane.xml`.
 * Only a locked sheet goes out, a draft is not a document of the case yet.
 */
export function buildEzdPackage(
  source: ExportSource,
  options: { caseMark: string | null; at: Date },
): Uint8Array {
  const { view } = source;
  if (view.sheet.state !== 'locked') {
    throw new ExportError('not_exportable', 'Only a locked sheet goes to an EZD system');
  }
  const render = { standard: 'a-2a', createdAt: options.at } as const;
  const sheet = buildSheetDocument(source, { signatureBox: false });
  const evaluator =
    source.evaluator === null
      ? ''
      : `${source.evaluator.firstName} ${source.evaluator.lastName}`.trim();
  const subject = `${view.snapshot.firstName} ${view.snapshot.lastName}`;
  const approvedOn = sheet.approvals.find(
    (approval) => approval.kind === 'sheet_approved',
  )?.occurredOn;
  const sheetSha256 = sheet.approvals.at(-1)?.sheetSha256 ?? '';

  const sheetBytes = renderSheetPdf(sheet, render);
  const files: PackageFile[] = [
    { path: 'arkusz.pdf', bytes: sheetBytes, description: 'Arkusz oceny okresowej' },
  ];
  const documents: DocumentMetadata[] = [
    {
      id: `${view.id}/arkusz`,
      file: 'arkusz.pdf',
      creator: evaluator,
      office: source.officeName,
      title: `Ocena okresowa, arkusz ${view.sheetId}, ${subject}`,
      date: approvedOn ?? sheet.partTwo.periodTo ?? '',
      type: 'arkusz oceny okresowej',
      relation: null,
      description: `Arkusz ${view.sheetId}, wersja ${String(sheet.version.number)}, okres od ${formatDate(sheet.partTwo.periodFrom)} do ${formatDate(sheet.partTwo.periodTo)}`,
      fileSha256: sha256Hex(sheetBytes),
      sheetSha256,
    },
  ];
  for (const { eventId, path } of noticePaths(source)) {
    const notice = buildNoticeDocument(source, eventId, { signatureBox: false });
    const bytes = renderNoticePdf(notice, render);
    files.push({ path, bytes, description: 'Zawiadomienie o zmianie terminu' });
    documents.push({
      id: `${view.id}/${eventId}`,
      file: path,
      creator: evaluator,
      office: source.officeName,
      title: `Zawiadomienie o zmianie terminu sporządzenia oceny, ${subject}`,
      date: notice.noticeOn,
      type: 'zawiadomienie',
      relation: { kind: 'zalacznik-do', target: 'arkusz.pdf' },
      description: `Nowy termin sporządzenia oceny: ${formatDate(notice.newDueOn)}`,
      fileSha256: sha256Hex(bytes),
      sheetSha256,
    });
  }
  files.push({
    path: 'metadane.xml',
    bytes: strToU8(metadataXml(documents, options.caseMark)),
    description: 'Metadane dokumentów',
  });
  return zipFiles(files, options.at);
}
