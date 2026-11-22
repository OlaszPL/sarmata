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

/** One group of the inbox. `markable` adds the "mark as read" form to every row. */
export function InboxTable({
  caption,
  entries,
  markable,
}: {
  caption: string;
  entries: InboxEntry[];
  markable: boolean;
}) {
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
                cell: (entry: InboxEntry) => (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={entry.id} />
                    <Button type="submit" variant="link" className="relative">
                      Oznacz jako przeczytane
                      <span className="sr-only">
                        : {entry.employeeName}, {entry.title}
                      </span>
                    </Button>
                  </form>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
