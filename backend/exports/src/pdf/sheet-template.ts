import { formatDate, formatDateTime, formatMean } from '../format';
import { type PlaceAndDate, type SheetDocument } from '../sheet-document';
import { PREAMBLE } from './preamble';
import { type RenderOptions, renderPdf } from './typst';

const STATE_NAMES: Record<SheetDocument['version']['state'], string> = {
  draft: 'projekt',
  locked: 'zatwierdzona',
  superseded: 'zastąpiona',
  cancelled: 'anulowana',
};

const placeAndDate = (value: PlaceAndDate | null) =>
  value === null ? null : { place: value.place, date: formatDate(value.occurredOn) };

/** The model as the template reads it: dates and numbers already formatted. */
export function sheetTemplateData(document: SheetDocument) {
  const { partOne, partTwo, partThree } = document;
  const labels = document.labels;
  const reason =
    document.version.reason === null ? '' : `. ${labels.reasonLabel}: ${document.version.reason}`;
  return {
    title: document.title,
    author: document.officeName,
    isDraft: document.isDraft,
    draftMark: labels.draftMark,
    heading: document.title,
    versionLine: `${labels.versionLabel}: ${String(document.version.number)} (${STATE_NAMES[document.version.state]})${reason}`,
    labels,
    footnotes: document.footnotes,
    officeName: document.officeName,
    signatureBox: document.signatureBox,
    partOne: {
      ...partOne,
      dueOn: formatDate(partOne.dueOn),
    },
    partTwo: {
      ...partTwo,
      interviewOn: formatDate(partTwo.interviewOn),
      periodFrom: formatDate(partTwo.periodFrom),
      periodTo: formatDate(partTwo.periodTo),
      mean: partTwo.mean === null ? '' : formatMean(partTwo.mean),
      previous: {
        outcome: partTwo.previous?.outcomeLabel ?? '',
        level: partTwo.previous?.levelName ?? '',
        date: partTwo.previous === null ? '' : formatDate(partTwo.previous.draftedOn),
      },
    },
    partThree:
      partThree === null
        ? null
        : {
            ...partThree,
            appointmentYear:
              partThree.appointmentYear === null ? '' : String(partThree.appointmentYear),
            currentGrade: partThree.currentGrade === null ? '' : String(partThree.currentGrade),
            gradeGrantedOn: formatDate(partThree.gradeGrantedOn),
            requestedGrade: String(partThree.requestedGrade),
          },
    placeAndDate: {
      partOneEvaluator: placeAndDate(document.placeAndDate.partOneEvaluator),
      partOneEvaluated: placeAndDate(document.placeAndDate.partOneEvaluated),
      partTwoEvaluator: placeAndDate(document.placeAndDate.partTwoEvaluator),
      partTwoEvaluated: placeAndDate(document.placeAndDate.partTwoEvaluated),
    },
    approvals: document.approvals.map((approval) => ({
      label: approval.label,
      occurredOn: formatDate(approval.occurredOn),
      recordedAt: formatDateTime(approval.recordedAt),
      recordedBy: approval.recordedBy,
      version: String(approval.sheetVersion),
      sha1: approval.sheetSha256.slice(0, 32),
      sha2: approval.sheetSha256.slice(32),
      refusalNote: approval.refusalNote,
      witnesses: approval.witnesses,
    })),
    attachments: document.attachments.map((notice) => ({
      text: `Zawiadomienie z dnia ${formatDate(notice.noticeOn)}: nowy termin ${formatDate(notice.newDueOn)}, przyczyna: ${notice.reasonLabel}.`,
    })),
  };
}

/** Layout after the forms of annexes 2 to 4. Signatures become approvals from the event log. */
export const SHEET_TEMPLATE = `${PREAMBLE}${String.raw`
#let l = data.labels
#let fn(key) = if key in data.footnotes { footnote(data.footnotes.at(key)) }
#let blank = [..........]
#let val(v) = if v == "" { blank } else { strong(v) }
#let field(name, v, key: none) = grid(
  columns: (38%, 1fr),
  gutter: 4pt,
  [#name#if key != none { fn(key) }],
  val(v),
)
#let person(p, title, evaluated) = block(width: 100%, stroke: 0.5pt + luma(90), inset: 6pt, breakable: false)[
  #strong(title)
  #field(l.firstName, p.firstName)
  #field(l.lastName, p.lastName)
  #if data.partOne.orgUnitFields { field(l.orgUnit, p.orgUnit) }
  #field(l.position, p.positionTitle, key: if evaluated { "positionTitle" } else { none })
]
#let sign(pd, role) = block(breakable: false, width: 100%, above: 1em)[
  #l.placeAndDate: #strong[#if pd == none [#blank] else [#if pd.place != none [#pd.place, ]#pd.date]] \
  #role: #if pd == none [#l.noApproval] else [#l.approvedInSystem]
  #if data.signatureBox [
    \
    #box(width: 70mm, height: 15mm, stroke: 0.5pt)[]
  ]
]
#let section(title) = block(above: 1em, below: 0.5em)[#strong(title)]

= #data.heading#fn("scope")

#data.versionLine

== #l.partOne

#field(l.office, data.officeName)
#person(data.partOne.evaluated, l.evaluatedData, true)
#person(data.partOne.evaluator, l.evaluatorData, false)

#section(l.criteriaAndDue)
#l.mandatoryCriteria:
#list(..data.partOne.mandatoryCriteria)
#l.additionalCriteria#fn("additionalCriteria"):
#if data.partOne.additionalCriteria.len() == 0 [#l.noAdditionalCriteria] else { list(..data.partOne.additionalCriteria) }
#field(l.dueOn, data.partOne.dueOn)

#l.confirmation#fn("introTalk")

#sign(data.placeAndDate.partOneEvaluator, l.evaluatorSignature)
#sign(data.placeAndDate.partOneEvaluated, l.evaluatedSignature)

== #l.partTwo

#field(l.interviewOn, data.partTwo.interviewOn, key: "interviewTalk")
#section(l.period)
#field(l.periodFrom, data.partTwo.periodFrom, key: "periodFrom")
#field(l.periodTo, data.partTwo.periodTo, key: "periodTo")

#section[#l.criteriaRatings#fn("markX")]
#table(
  columns: (1fr, ..data.partTwo.scale.map(_ => 21mm)),
  align: (left, ..data.partTwo.scale.map(_ => center + horizon)),
  table.header(
    [#strong(l.criterion)],
    ..data.partTwo.scale.map(c => [#strong(c.name) \ #c.points]),
  ),
  ..data.partTwo.criteria.map(row => (
    [#row.name],
    ..data.partTwo.scale.map(c => if row.markedCode == c.code [X] else []),
  )).flatten(),
)

#field(l.mean, data.partTwo.mean)

#section(l.overallLevel)
#table(
  columns: data.partTwo.bands.len() * (1fr,),
  align: center + horizon,
  table.header(..data.partTwo.bands.map(b => [#strong(b.name)])),
  ..data.partTwo.bands.map(b => [#b.range]),
  ..data.partTwo.bands.map(b => if b.marked [X] else []),
)

#section(l.periodicEvaluation)
#box(width: 5mm, height: 5mm, stroke: 0.5pt, align(center + horizon)[#if data.partTwo.outcome == "positive" [X]])
#l.positive#fn("positive")
#h(10mm)
#box(width: 5mm, height: 5mm, stroke: 0.5pt, align(center + horizon)[#if data.partTwo.outcome == "negative" [X]])
#l.negative#fn("negative")

#section[#l.justification#fn("justification")]
#if data.partTwo.justification == "" { blank } else { data.partTwo.justification }

#section[#l.developmentConclusions#fn("developmentProgram")]
#if data.partTwo.developmentConclusions == "" { blank } else { data.partTwo.developmentConclusions }

#section(l.previousEvaluation)
#field(l.previousOutcome, data.partTwo.previous.outcome, key: "previousOutcome")
#field(l.previousLevel, data.partTwo.previous.level, key: "previousLevel")
#field(l.previousDate, data.partTwo.previous.date)

#section(l.gradeRequestQuestion)
#for option in (("yes", l.yes), ("no", l.no), ("not_applicable", l.notApplicable)) [
  #box(width: 5mm, height: 5mm, stroke: 0.5pt, align(center + horizon)[#if data.partTwo.gradeRequestAnswer == option.at(0) [X]])
  #option.at(1)
  #h(8mm)
]

#person(data.partOne.evaluator, l.evaluatorData, false)
#sign(data.placeAndDate.partTwoEvaluator, l.evaluatorSignature)

#l.evaluatedAcknowledgement
#sign(data.placeAndDate.partTwoEvaluated, l.evaluatedSignature)

#section[#l.instruction#fn("objectionAddressee")]
#data.partTwo.objectionNotice

#if data.partThree != none [
  == #l.partThree

  #l.partThreeIntro
  #section(l.civilServantData)
  #field(l.firstName, data.partThree.firstName)
  #field(l.lastName, data.partThree.lastName)
  #field(l.appointmentYear, data.partThree.appointmentYear)
  #field(l.currentGrade, data.partThree.currentGrade)
  #field(l.gradeGrantedOn, data.partThree.gradeGrantedOn)
  #section(l.gradeRequestHeading)
  #field(l.gradeRequestHeading, data.partThree.requestedGrade)
  #section(l.gradeRequestMotivation)
  #data.partThree.motivation
  #person(data.partThree.evaluator, l.evaluatorData, false)
  #sign(data.placeAndDate.partTwoEvaluator, l.evaluatorSignature)
]

== #l.approvalsHeading

#l.approvalsIntro

#if data.approvals.len() == 0 [#l.noApprovals] else [
  #table(
    columns: (auto, auto, auto, auto, auto, 1fr),
    table.header(..l.approvalColumns.map(c => [#strong(c)])),
    ..data.approvals.map(a => (
      [#a.label],
      [#a.occurredOn],
      [#a.recordedAt],
      [#a.recordedBy],
      [#a.version],
      text(size: 6.5pt)[#a.sha1 \ #a.sha2],
    )).flatten(),
  )
]

#for a in data.approvals.filter(a => a.refusalNote != none or a.witnesses.len() > 0) [
  #strong(a.label) (#a.occurredOn):
  #if a.refusalNote != none [#l.refusalNote: #a.refusalNote.]
  #if a.witnesses.len() > 0 [#l.witnesses: #a.witnesses.join(", ").]
  \
]

#if data.attachments.len() > 0 [
  #section(l.attachmentsHeading)
  #list(..data.attachments.map(n => [#n.text]))
]
`}`;

/** Renders one sheet version as PDF with the given standard. */
export function renderSheetPdf(document: SheetDocument, options: RenderOptions): Uint8Array {
  return renderPdf(SHEET_TEMPLATE, sheetTemplateData(document), options);
}
