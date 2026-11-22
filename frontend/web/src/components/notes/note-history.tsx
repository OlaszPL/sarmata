import Link from 'next/link';
import type { NoteVersion } from '@sarmata/services';
import { Section } from '@sarmata/ui';
import { noteKindLabels, noteSignLabels } from '@/lib/employees/labels';
import { formatDate } from '@/lib/format';

const dateTime = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export interface NoteHistoryProps {
  /** Oldest first, as the service returns them. Shown newest first. */
  versions: readonly NoteVersion[];
  criteria: ReadonlyMap<string, string>;
  closeHref: string;
}

/** Every version of a note, the current one on top, each with the moment it was saved. */
export function NoteHistory({ versions, criteria, closeHref }: NoteHistoryProps) {
  const newestFirst = [...versions].sort((a, b) => b.version - a.version);
  return (
    <Section
      id="historia"
      title="Historia zmian notatki"
      actions={
        <Link
          href={closeHref}
          className="font-heading text-link leading-[normal] font-medium underline"
        >
          Zamknij historię
        </Link>
      }
    >
      <ol className="border-rule grid border-t">
        {newestFirst.map((version) => {
          const rows: { key: string; value: string }[] = [
            { key: 'Rodzaj notatki', value: noteKindLabels[version.kind] },
            { key: 'Data zdarzenia', value: formatDate(version.occurredOn) },
            {
              key: 'Kryterium',
              value: version.criterionId
                ? (criteria.get(version.criterionId) ?? version.criterionId)
                : 'Bez kryterium',
            },
            {
              key: 'Wydźwięk',
              value: version.sign ? noteSignLabels[version.sign] : 'Bez wydźwięku',
            },
            { key: 'Przekazano pracownikowi', value: version.communicated ? 'Tak' : 'Nie' },
          ];
          return (
            <li key={version.version} className="border-rule grid gap-3 border-b py-5">
              <h3 className="text-ink text-xl leading-[normal] font-semibold">
                Wersja {version.version}
                {version.validTo === null ? ', obecna' : null}
              </h3>
              <p className="text-ink-muted text-[0.9375rem]">
                Zapisano {dateTime.format(new Date(version.validFrom))}
              </p>
              <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
                {rows.map((row) => (
                  <div key={row.key} className="contents">
                    <dt className="font-heading font-semibold">{row.key}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="max-w-[70ch] whitespace-pre-line">{version.body}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
