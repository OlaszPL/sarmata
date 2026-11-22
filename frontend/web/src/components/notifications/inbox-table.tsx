import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button, DataTable, Tag } from '@sarmata/ui';
import { markNotificationRead } from '@/app/(app)/powiadomienia/actions';
import { type InboxEntry } from '@/lib/notifications/inbox';

function KindTag({ entry }: { entry: InboxEntry }) {
  if (entry.group === 'resolved') return <Tag tone="done">Załatwione</Tag>;
  return (
    <Tag tone={entry.kindLabel === 'Zadanie' ? 'attention' : 'waiting'}>{entry.kindLabel}</Tag>
  );
}

function MarkReadForm({ entry }: { entry: InboxEntry }) {
  return (
    <form action={markNotificationRead}>
      <input type="hidden" name="id" value={entry.id} />
      <Button type="submit" variant="link" className="relative">
        Oznacz jako przeczytane
        <span className="sr-only">
          : {entry.employeeName}, {entry.title}
        </span>
      </Button>
    </form>
  );
}

/**
 * The group as a stacked list for narrow screens, where a five column table would hide the due
 * date and the action behind a sideways scroll.
 */
function InboxList({ caption, entries, markable }: InboxTableProps) {
  return (
    <ul aria-label={caption} className="border-rule border-t-2 md:hidden">
      {entries.map((entry) => (
        <li key={entry.id} className="border-rule flex flex-col gap-2 border-b py-4">
          <Link
            href={entry.href}
            className="font-heading text-link relative self-start leading-[normal] font-semibold underline"
          >
            {entry.employeeName}
            <span className="sr-only">, otwórz sprawę</span>
          </Link>
          <div>
            <p className="font-heading leading-[normal] font-semibold">{entry.title}</p>
            <p className="mt-1">{entry.summary}</p>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-heading font-semibold">{entry.dueOn}</span>
            <span className="flex items-center gap-1.5">
              {entry.overdue ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : null}
              {entry.dueText}
            </span>
            <KindTag entry={entry} />
          </p>
          {markable ? <MarkReadForm entry={entry} /> : null}
        </li>
      ))}
    </ul>
  );
}

interface InboxTableProps {
  caption: string;
  entries: InboxEntry[];
  markable: boolean;
}

/**
 * One group of the inbox: a table from `md`, a stacked list below. `markable` adds the "mark as
 * read" form to every entry. The hidden variant is `display: none`, so only one is announced.
 */
export function InboxTable({ caption, entries, markable }: InboxTableProps) {
  return (
    <>
      <InboxList caption={caption} entries={entries} markable={markable} />
      <div className="hidden md:block">
        <InboxDataTable caption={caption} entries={entries} markable={markable} />
      </div>
    </>
  );
}

function InboxDataTable({ caption, entries, markable }: InboxTableProps) {
  return (
    <DataTable
      caption={caption}
      rows={entries}
      rowKey={(entry) => entry.id}
      columns={[
        {
          key: 'employee',
          header: 'Pracownik',
          rowHeader: true,
          cell: (entry) => (
            <Link
              href={entry.href}
              // relative: the sr-only text is absolute and would escape the scrolling table otherwise.
              className="font-heading text-link relative leading-[normal] font-semibold underline"
            >
              {entry.employeeName}
              <span className="sr-only">, otwórz sprawę</span>
            </Link>
          ),
        },
        {
          key: 'about',
          header: 'Czego dotyczy',
          cell: (entry) => (
            <>
              <p className="font-heading leading-[normal] font-semibold">{entry.title}</p>
              <p className="mt-1">{entry.summary}</p>
            </>
          ),
        },
        {
          key: 'due',
          header: 'Termin',
          cell: (entry) => (
            <>
              <p className="font-heading leading-[normal] font-semibold">{entry.dueOn}</p>
              <p className="mt-1 flex items-center gap-1.5">
                {entry.overdue ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : null}
                {entry.dueText}
              </p>
            </>
          ),
        },
        { key: 'kind', header: 'Rodzaj', cell: (entry) => <KindTag entry={entry} /> },
        ...(markable
          ? [
              {
                key: 'action',
                header: 'Akcja',
                cell: (entry: InboxEntry) => <MarkReadForm entry={entry} />,
              },
            ]
          : []),
      ]}
    />
  );
}
