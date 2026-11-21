import {
  AlignmentType,
  Document,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  type IRunOptions,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { formatDate, formatDateTime, formatMean } from '../format';
import { PDF_FONT_FAMILY } from '../pdf/font';
import { type PlaceAndDate, type SheetDocument } from '../sheet-document';
import { type FootnoteKey } from '../regulation-2016-text';

/** The DOCX uses the same face constant as the PDF, so one change moves both (plan B6 task 3A). */
const FONT = PDF_FONT_FAMILY;
const LANGUAGE = 'pl-PL';
const BLANK = '..........';

const STATE_NAMES: Record<SheetDocument['version']['state'], string> = {
  draft: 'projekt',
  locked: 'zatwierdzona',
  superseded: 'zastąpiona',
  cancelled: 'anulowana',
};

/** Typed as `IRunOptions` so `bold` is read as a run property and not as `String.prototype.bold`. */
const textRun = (options: IRunOptions) => new TextRun(options);

const run = (text: string, options: { bold?: boolean; size?: number } = {}) =>
  textRun({
    text,
    ...(options.bold === true ? { bold: true } : {}),
    ...(options.size === undefined ? {} : { size: options.size }),
  });

const paragraph = (text: string, options: { bold?: boolean; after?: number } = {}) =>
  new Paragraph({
    children: [run(text, options.bold === true ? { bold: true } : {})],
    spacing: { after: options.after ?? 80 },
  });

const cell = (children: Paragraph[] | string, options: { center?: boolean } = {}) =>
  new TableCell({
    children:
      typeof children === 'string'
        ? [
            new Paragraph({
              children: [run(children)],
              ...(options.center === true ? { alignment: AlignmentType.CENTER } : {}),
            }),
          ]
        : children,
  });

const headerCell = (text: string, options: { center?: boolean } = {}) =>
  new TableCell({
    children: [
      new Paragraph({
        children: [run(text, { bold: true })],
        ...(options.center === true ? { alignment: AlignmentType.CENTER } : {}),
      }),
    ],
  });

const table = (header: TableCell[], rows: TableRow[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: header }), ...rows],
  });

/** Footnotes of the sheet. Word numbers them in order of reference, the ids only have to be unique. */
class Notes {
  private readonly texts: Record<string, { children: Paragraph[] }> = {};
  private next = 1;

  constructor(private readonly source: Partial<Record<FootnoteKey, string>>) {}

  ref(key: FootnoteKey): FootnoteReferenceRun[] {
    const text = this.source[key];
    if (text === undefined) return [];
    const id = this.next;
    this.next += 1;
    this.texts[String(id)] = { children: [new Paragraph({ children: [run(text, { size: 16 })] })] };
    return [new FootnoteReferenceRun(id)];
  }

  get all(): Record<string, { children: Paragraph[] }> {
    return this.texts;
  }
}

/** Word version of the sheet. Same content and order as the PDF, built from the same model. */
export async function renderSheetDocx(document: SheetDocument): Promise<Uint8Array> {
  const labels = document.labels;
  const notes = new Notes(document.footnotes);
  const body: (Paragraph | Table)[] = [];

  const heading = (text: string, level: 1 | 2, key?: FootnoteKey) =>
    new Paragraph({
      heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      children: [run(text), ...(key === undefined ? [] : notes.ref(key))],
    });
  const label = (text: string, key?: FootnoteKey) =>
    new Paragraph({
      children: [run(text, { bold: true }), ...(key === undefined ? [] : notes.ref(key))],
      spacing: { before: 160, after: 80 },
    });
  const field = (name: string, value: string, key?: FootnoteKey) =>
    new Paragraph({
      children: [
        run(`${name}: `),
        ...(key === undefined ? [] : notes.ref(key)),
        run(value === '' ? BLANK : value, { bold: true }),
      ],
      spacing: { after: 40 },
    });
  const person = (
    title: string,
    data: SheetDocument['partOne']['evaluated'],
    evaluated: boolean,
  ) => [
    label(title),
    field(labels.firstName, data.firstName),
    field(labels.lastName, data.lastName),
    ...(document.partOne.orgUnitFields ? [field(labels.orgUnit, data.orgUnit)] : []),
    field(labels.position, data.positionTitle, evaluated ? 'positionTitle' : undefined),
  ];
  const sign = (value: PlaceAndDate | null, role: string) => [
    new Paragraph({
      children: [
        run(`${labels.placeAndDate}: `),
        run(
          value === null
            ? BLANK
            : `${value.place === null ? '' : `${value.place}, `}${formatDate(value.occurredOn)}`,
          { bold: true },
        ),
      ],
      spacing: { before: 120, after: 40 },
    }),
    paragraph(`${role}: ${value === null ? labels.noApproval : labels.approvedInSystem}`),
    ...(document.signatureBox
      ? [
          new Table({
            width: { size: 40, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ height: { value: 800, rule: 'atLeast' }, children: [cell('')] })],
          }),
        ]
      : []),
  ];

  body.push(heading(document.title, 1, 'scope'));
  body.push(
    paragraph(
      `${labels.versionLabel}: ${String(document.version.number)} (${STATE_NAMES[document.version.state]})${
        document.version.reason === null
          ? ''
          : `. ${labels.reasonLabel}: ${document.version.reason}`
      }`,
    ),
  );

  // Part I
  const one = document.partOne;
  body.push(heading(labels.partOne, 2));
  body.push(field(labels.office, document.officeName));
  body.push(...person(labels.evaluatedData, one.evaluated, true));
  body.push(...person(labels.evaluatorData, one.evaluator, false));
  body.push(label(labels.criteriaAndDue));
  body.push(paragraph(`${labels.mandatoryCriteria}:`));
  for (const name of one.mandatoryCriteria) {
    body.push(new Paragraph({ children: [run(name)], bullet: { level: 0 } }));
  }
  body.push(
    new Paragraph({
      children: [run(labels.additionalCriteria), ...notes.ref('additionalCriteria'), run(':')],
    }),
  );
  if (one.additionalCriteria.length === 0) body.push(paragraph(labels.noAdditionalCriteria));
  for (const name of one.additionalCriteria) {
    body.push(new Paragraph({ children: [run(name)], bullet: { level: 0 } }));
  }
  body.push(field(labels.dueOn, formatDate(one.dueOn)));
  body.push(
    new Paragraph({
      children: [run(labels.confirmation), ...notes.ref('introTalk')],
      spacing: { before: 120 },
    }),
  );
  body.push(...sign(document.placeAndDate.partOneEvaluator, labels.evaluatorSignature));
  body.push(...sign(document.placeAndDate.partOneEvaluated, labels.evaluatedSignature));

  // Part II
  const two = document.partTwo;
  body.push(heading(labels.partTwo, 2));
  body.push(field(labels.interviewOn, formatDate(two.interviewOn), 'interviewTalk'));
  body.push(label(labels.period));
  body.push(field(labels.periodFrom, formatDate(two.periodFrom), 'periodFrom'));
  body.push(field(labels.periodTo, formatDate(two.periodTo), 'periodTo'));
  body.push(label(labels.criteriaRatings, 'markX'));
  body.push(
    table(
      [
        headerCell(labels.criterion),
        ...two.scale.map((column) =>
          headerCell(`${column.name} (${String(column.points)})`, { center: true }),
        ),
      ],
      two.criteria.map(
        (row) =>
          new TableRow({
            children: [
              cell(row.name),
              ...two.scale.map((column) =>
                cell(row.markedCode === column.code ? 'X' : '', { center: true }),
              ),
            ],
          }),
      ),
    ),
  );
  body.push(field(labels.mean, two.mean === null ? '' : formatMean(two.mean)));
  body.push(label(labels.overallLevel));
  body.push(
    table(
      two.bands.map((band) => headerCell(band.name, { center: true })),
      [
        new TableRow({ children: two.bands.map((band) => cell(band.range, { center: true })) }),
        new TableRow({
          children: two.bands.map((band) => cell(band.marked ? 'X' : '', { center: true })),
        }),
      ],
    ),
  );
  body.push(label(labels.periodicEvaluation));
  body.push(
    new Paragraph({
      children: [
        run(`[${two.outcome === 'positive' ? 'X' : ' '}] ${labels.positive}`),
        ...notes.ref('positive'),
        run(`     [${two.outcome === 'negative' ? 'X' : ' '}] ${labels.negative}`),
        ...notes.ref('negative'),
      ],
    }),
  );
  body.push(label(labels.justification, 'justification'));
  body.push(paragraph(two.justification === '' ? BLANK : two.justification));
  body.push(label(labels.developmentConclusions, 'developmentProgram'));
  body.push(paragraph(two.developmentConclusions === '' ? BLANK : two.developmentConclusions));
  body.push(label(labels.previousEvaluation));
  body.push(field(labels.previousOutcome, two.previous?.outcomeLabel ?? '', 'previousOutcome'));
  body.push(field(labels.previousLevel, two.previous?.levelName ?? '', 'previousLevel'));
  body.push(field(labels.previousDate, formatDate(two.previous?.draftedOn ?? null)));
  body.push(label(labels.gradeRequestQuestion));
  const answers = [
    ['yes', labels.yes],
    ['no', labels.no],
    ['not_applicable', labels.notApplicable],
  ] as const;
  body.push(
    paragraph(
      answers
        .map(([code, text]) => `[${two.gradeRequestAnswer === code ? 'X' : ' '}] ${text}`)
        .join('     '),
    ),
  );
  body.push(...person(labels.evaluatorData, one.evaluator, false));
  body.push(...sign(document.placeAndDate.partTwoEvaluator, labels.evaluatorSignature));
  body.push(paragraph(labels.evaluatedAcknowledgement));
  body.push(...sign(document.placeAndDate.partTwoEvaluated, labels.evaluatedSignature));
  body.push(label(labels.instruction, 'objectionAddressee'));
  body.push(paragraph(two.objectionNotice));

  // Part III
  const three = document.partThree;
  if (three !== null) {
    body.push(heading(labels.partThree, 2));
    body.push(paragraph(labels.partThreeIntro));
    body.push(label(labels.civilServantData));
    body.push(field(labels.firstName, three.firstName));
    body.push(field(labels.lastName, three.lastName));
    body.push(
      field(
        labels.appointmentYear,
        three.appointmentYear === null ? '' : String(three.appointmentYear),
      ),
    );
    body.push(
      field(labels.currentGrade, three.currentGrade === null ? '' : String(three.currentGrade)),
    );
    body.push(field(labels.gradeGrantedOn, formatDate(three.gradeGrantedOn)));
    body.push(label(labels.gradeRequestHeading));
    body.push(paragraph(String(three.requestedGrade)));
    body.push(label(labels.gradeRequestMotivation));
    body.push(paragraph(three.motivation === '' ? BLANK : three.motivation));
    body.push(...person(labels.evaluatorData, three.evaluator, false));
    body.push(...sign(document.placeAndDate.partTwoEvaluator, labels.evaluatorSignature));
  }

  // Approvals
  body.push(heading(labels.approvalsHeading, 2));
  body.push(paragraph(labels.approvalsIntro));
  if (document.approvals.length === 0) {
    body.push(paragraph(labels.noApprovals));
  } else {
    body.push(
      table(
        labels.approvalColumns.map((name) => headerCell(name)),
        document.approvals.map(
          (approval) =>
            new TableRow({
              children: [
                cell(approval.label),
                cell(formatDate(approval.occurredOn)),
                cell(formatDateTime(approval.recordedAt)),
                cell(approval.recordedBy),
                cell(String(approval.sheetVersion)),
                cell(approval.sheetSha256),
              ],
            }),
        ),
      ),
    );
    for (const approval of document.approvals) {
      if (approval.refusalNote === null && approval.witnesses.length === 0) continue;
      const parts = [
        ...(approval.refusalNote === null
          ? []
          : [`${labels.refusalNote}: ${approval.refusalNote}`]),
        ...(approval.witnesses.length === 0
          ? []
          : [`${labels.witnesses}: ${approval.witnesses.join(', ')}`]),
      ];
      body.push(
        paragraph(`${approval.label} (${formatDate(approval.occurredOn)}). ${parts.join('. ')}.`),
      );
    }
  }
  if (document.attachments.length > 0) {
    body.push(label(labels.attachmentsHeading));
    for (const notice of document.attachments) {
      body.push(
        new Paragraph({
          children: [
            run(
              `Zawiadomienie z dnia ${formatDate(notice.noticeOn)}: nowy termin ${formatDate(notice.newDueOn)}, przyczyna: ${notice.reasonLabel}.`,
            ),
          ],
          bullet: { level: 0 },
        }),
      );
    }
  }

  const draftHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [textRun({ text: labels.draftMark, bold: true, color: 'B00020', size: 28 })],
      }),
    ],
  });

  const file = new Document({
    title: document.title,
    creator: document.officeName,
    styles: {
      default: {
        document: { run: { font: FONT, size: 20, language: { value: LANGUAGE } } },
        heading1: { run: { font: FONT, size: 26, bold: true } },
        heading2: { run: { font: FONT, size: 22, bold: true } },
      },
    },
    footnotes: notes.all,
    sections: [
      {
        ...(document.isDraft ? { headers: { default: draftHeader } } : {}),
        children: body,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(file));
}
