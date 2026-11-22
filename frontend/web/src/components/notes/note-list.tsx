import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Note } from '@sarmata/services';
import { Tag } from '@sarmata/ui';
import { noteKindLabels, noteSignLabels } from '@/lib/employees/labels';
import { formatDate } from '@/lib/format';
import { routes } from '@/lib/routes';

const linkClasses = 'font-heading text-link leading-[normal] font-medium underline';

export interface NoteListProps {
  notes: readonly Note[];
  /** Criterion id to name, from the regulation catalog. An unknown id shows as it is. */
  criteria: ReadonlyMap<string, string>;
  /** Employee id to name, given on `/notatki` where notes of many people meet. */
  employeeNames?: ReadonlyMap<string, string> | undefined;
  myUserId: string;
  editHref: (note: Note) => string;
  historyHref: (note: Note) => string;
  empty: ReactNode;
}

/** Notes in the given order (newest event first from the service), one entry per note. */
export function NoteList({
  notes,
  criteria,
  employeeNames,
  myUserId,
  editHref,
  historyHref,
  empty,
}: NoteListProps) {
  if (notes.length === 0) return <>{empty}</>;
  return (
    <ol className="border-rule grid border-t">
      {notes.map((note) => {
        const mine = note.authorAccountId === myUserId;
        const employeeName = employeeNames?.get(note.employeeId);
        const title = `${noteKindLabels[note.kind]}, ${formatDate(note.occurredOn)}`;
        const context = employeeName ? `${title}, ${employeeName}` : title;
        return (
          <li key={note.id} className="border-rule grid gap-3 border-b py-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h3 className="text-ink text-xl leading-[normal] font-semibold">{title}</h3>
              {note.sign ? <Tag tone="neutral">{noteSignLabels[note.sign]}</Tag> : null}
              {note.communicated ? <Tag tone="done">Przekazano pracownikowi</Tag> : null}
            </div>
            {employeeName || note.criterionId || mine ? (
              <p className="text-ink-muted flex flex-wrap gap-x-4 gap-y-1 text-[0.9375rem]">
                {employeeName ? (
                  <Link
                    href={routes.employee(note.employeeId)}
                    className="font-heading text-link font-semibold underline"
                  >
                    {employeeName}
                  </Link>
                ) : null}
                {note.criterionId ? (
                  <span>Kryterium: {criteria.get(note.criterionId) ?? note.criterionId}</span>
                ) : null}
                {mine ? <span>Twoja notatka</span> : null}
              </p>
            ) : null}
            <p className="max-w-[70ch] whitespace-pre-line">{note.body}</p>
            {mine || note.version > 1 ? (
              <p className="flex flex-wrap gap-x-6 gap-y-2">
                {mine ? (
                  <Link href={editHref(note)} className={linkClasses}>
                    Edytuj<span className="sr-only"> notatkę {context}</span>
                  </Link>
                ) : null}
                {note.version > 1 ? (
                  <Link href={historyHref(note)} className={linkClasses}>
                    Historia zmian<span className="sr-only"> notatki {context}</span>
                  </Link>
                ) : null}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
