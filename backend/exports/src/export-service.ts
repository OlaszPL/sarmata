import { buildCaseFile } from './case-file';
import { ExportError } from './errors';
import { buildEzdPackage } from './ezd-package';
import { fileNamePart } from './format';
import { renderSheetDocx } from './docx/sheet-docx';
import { buildNoticeDocument } from './notice-document';
import { renderNoticePdf } from './pdf/notice-template';
import { renderSheetPdf } from './pdf/sheet-template';
import { buildSheetDocument, type ExportSource } from './sheet-document';

export type ExportRequest =
  | { kind: 'sheet_pdf'; signatureBox?: boolean }
  | { kind: 'sheet_docx'; signatureBox?: boolean }
  | { kind: 'term_notice'; eventId: string; signatureBox?: boolean }
  | { kind: 'case_file' }
  | { kind: 'ezd_package'; caseMark?: string };

/** A generated file. The name keeps Polish letters, the route turns it into an ASCII fallback. */
export interface ExportFile {
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
}

export interface ExportService {
  /** Throws `ExportError`. Access follows the RLS of the client that loaded the source. */
  export(evaluationId: string, request: ExportRequest): Promise<ExportFile>;
}

export interface ExportServiceDependencies {
  /** Everything one export reads, or `null` when the evaluation does not exist or is not visible. */
  readonly load: (evaluationId: string) => Promise<ExportSource | null>;
  readonly now: () => Date;
}

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ZIP = 'application/zip';

export function createExportService({ load, now }: ExportServiceDependencies): ExportService {
  return {
    async export(evaluationId, request) {
      const source = await load(evaluationId);
      if (source === null) {
        throw new ExportError('not_found', `Evaluation ${evaluationId} not found`);
      }
      const at = now();
      const { snapshot, sheetId } = source.view;
      const person = `${fileNamePart(snapshot.lastName)}-${fileNamePart(snapshot.firstName)}`;
      const signatureBox = 'signatureBox' in request ? (request.signatureBox ?? false) : false;
      const sheet = () => buildSheetDocument(source, { signatureBox });
      const date = () => {
        const document = sheet();
        return (
          document.approvals.find((approval) => approval.kind === 'sheet_approved')?.occurredOn ??
          document.partTwo.periodTo ??
          at.toISOString().slice(0, 10)
        );
      };

      switch (request.kind) {
        case 'sheet_pdf':
          return {
            fileName: `arkusz-${sheetId}-${person}-${date()}.pdf`,
            contentType: PDF,
            bytes: renderSheetPdf(sheet(), { standard: 'ua-1', createdAt: at }),
          };
        case 'sheet_docx':
          return {
            fileName: `arkusz-${sheetId}-${person}-${date()}.docx`,
            contentType: DOCX,
            bytes: await renderSheetDocx(sheet()),
          };
        case 'term_notice': {
          const notice = buildNoticeDocument(source, request.eventId, { signatureBox });
          return {
            fileName: `zawiadomienie-zmiana-terminu-${person}-${notice.noticeOn}.pdf`,
            contentType: PDF,
            bytes: renderNoticePdf(notice, { standard: 'ua-1', createdAt: at }),
          };
        }
        case 'case_file':
          return {
            fileName: `teczka-${sheetId}-${person}-${date()}.zip`,
            contentType: ZIP,
            bytes: buildCaseFile(source, at),
          };
        case 'ezd_package': {
          const caseMark = request.caseMark?.trim();
          return {
            fileName: `paczka-ezd-${sheetId}-${person}-${date()}.zip`,
            contentType: ZIP,
            bytes: buildEzdPackage(source, {
              caseMark: caseMark === undefined || caseMark === '' ? null : caseMark,
              at,
            }),
          };
        }
      }
    },
  };
}
