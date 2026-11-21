import { type CalendarDate } from '@sarmata/domain';
import { ExportError } from './errors';
import { type ExportSource, type PersonLine, noticeLabelsFor, termNotices } from './sheet-document';
import { type NoticeLabels } from './regulation-2016-text';

export interface NoticeDocument {
  readonly officeName: string;
  readonly labels: NoticeLabels;
  readonly noticeOn: CalendarDate;
  /** Place next to the date of the letter, from office settings. */
  readonly place: string | null;
  readonly newDueOn: CalendarDate;
  readonly reasonLabel: string;
  readonly addressee: PersonLine;
  /** The evaluator who gives the notice. */
  readonly evaluator: PersonLine;
  /** The system record of the change: who wrote it and when. */
  readonly approval: {
    readonly eventId: string;
    readonly occurredOn: CalendarDate;
    readonly recordedAt: string;
    readonly recordedBy: string;
  };
  readonly signatureBox: boolean;
}

/** The written notice about a changed evaluation term (art. 81 ust. 8, § 8) for one `term_changed` event. */
export function buildNoticeDocument(
  source: ExportSource,
  eventId: string,
  options: { signatureBox: boolean },
): NoticeDocument {
  const notice = termNotices(source).find((candidate) => candidate.eventId === eventId);
  const event = source.view.events.find((candidate) => candidate.id === eventId);
  if (notice === undefined || event === undefined) {
    throw new ExportError(
      'unknown_event',
      `Event ${eventId} is not a term change of this evaluation`,
    );
  }
  const { view } = source;
  return {
    officeName: source.officeName,
    labels: noticeLabelsFor(source.regulation),
    noticeOn: notice.noticeOn,
    place: source.defaultPlace ?? null,
    newDueOn: notice.newDueOn,
    reasonLabel: notice.reasonLabel,
    addressee: {
      firstName: view.snapshot.firstName,
      lastName: view.snapshot.lastName,
      orgUnit: view.currentPosition.orgUnit ?? '',
      positionTitle: view.currentPosition.positionTitle ?? '',
    },
    evaluator: {
      firstName: source.evaluator?.firstName ?? '',
      lastName: source.evaluator?.lastName ?? '',
      orgUnit: source.evaluator?.orgUnit ?? '',
      positionTitle: source.evaluator?.positionTitle ?? '',
    },
    approval: {
      eventId,
      occurredOn: event.occurredOn,
      recordedAt: event.recordedAt,
      recordedBy: source.accountNames.get(event.recordedBy) ?? event.recordedBy,
    },
    signatureBox: options.signatureBox,
  };
}
