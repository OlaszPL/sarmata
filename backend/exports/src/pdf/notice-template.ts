import { formatDate, formatDateTime } from '../format';
import { type NoticeDocument } from '../notice-document';
import { PREAMBLE } from './preamble';
import { type RenderOptions, renderPdf } from './typst';

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();

export function noticeTemplateData(notice: NoticeDocument) {
  const { labels } = notice;
  return {
    title: labels.title,
    author: notice.officeName,
    isDraft: false,
    draftMark: '',
    labels,
    officeName: notice.officeName,
    noticeOn: formatDate(notice.noticeOn),
    dateLine:
      notice.place === null
        ? formatDate(notice.noticeOn)
        : `${notice.place}, ${formatDate(notice.noticeOn)}`,
    addressee: {
      name: fullName(notice.addressee),
      position: notice.addressee.positionTitle,
      orgUnit: notice.addressee.orgUnit,
    },
    evaluator: {
      name: fullName(notice.evaluator),
      position: notice.evaluator.positionTitle,
    },
    newDueOn: formatDate(notice.newDueOn),
    reasonLabel: notice.reasonLabel,
    approval: {
      recordedAt: formatDateTime(notice.approval.recordedAt),
      recordedBy: notice.approval.recordedBy,
      occurredOn: formatDate(notice.approval.occurredOn),
    },
    signatureBox: notice.signatureBox,
  };
}

export const NOTICE_TEMPLATE = `${PREAMBLE}${String.raw`
#let l = data.labels

#align(right)[#data.dateLine]
#strong(data.officeName)

#v(1em)
#strong(l.addressee): #data.addressee.name \
#data.addressee.position#if data.addressee.orgUnit != "" [, #data.addressee.orgUnit]

= #l.title

#l.legalBasis

#strong(l.newDueOn): #data.newDueOn

#strong(l.reason): #data.reasonLabel

== #l.approvalHeading

#data.approval.recordedBy, #data.approval.recordedAt (#data.approval.occurredOn)

#v(1.5em)
#data.evaluator.name \
#data.evaluator.position \
#l.signature
#if data.signatureBox [
  \
  #box(width: 70mm, height: 15mm, stroke: 0.5pt)[]
]
`}`;

export function renderNoticePdf(notice: NoticeDocument, options: RenderOptions): Uint8Array {
  return renderPdf(NOTICE_TEMPLATE, noticeTemplateData(notice), options);
}
