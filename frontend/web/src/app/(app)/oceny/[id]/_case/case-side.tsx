import Link from 'next/link';
import { Download } from 'lucide-react';
import { Section } from '@sarmata/ui';
import { eventLabel } from '@/lib/evaluations/event-labels';
import { formatDate, formatScore } from '@/lib/format';
import { levelName } from '@/lib/regulation';
import { type EvaluationExportKind, routes } from '@/lib/routes';
import { type CaseData } from '../loader';

const RECENT_EVENTS = 3;

const downloads: readonly { kind: EvaluationExportKind; label: string }[] = [
  { kind: 'arkusz-pdf', label: 'Arkusz PDF według wzoru' },
  { kind: 'arkusz-docx', label: 'Arkusz DOCX' },
  { kind: 'teczka', label: 'Teczka sprawy ZIP' },
];

function ScoreExplanation({ data }: { data: CaseData }) {
  const { view, regulation } = data;
  const { mean, levelCode, outcome } = view.score;
  const count = view.criteria.length;
  const level = levelName(regulation, levelCode);

  return (
    <Section title="Jak liczony jest wynik" titleLevel={3}>
      <div className="flex flex-col gap-3">
        {/* One band per row: five ranges side by side do not fit the panel with room around the text. */}
        <ol aria-label="Przedziały średniej" className="border-rule border">
          {regulation.bands.map((band, index) => {
            const current = band.code === levelCode;
            return (
              <li
                key={band.code}
                className={`flex items-baseline gap-3 px-3 py-2.5 text-sm leading-[1.35] ${
                  index < regulation.bands.length - 1 ? 'border-rule border-b' : ''
                } ${current ? 'bg-navy text-white' : 'bg-white'}`}
              >
                <span className="font-heading w-[3.75rem] shrink-0 font-semibold whitespace-nowrap">
                  {band.label}
                </span>
                <span className="min-w-0 flex-1">{band.name}</span>
                {current ? (
                  <span className="font-heading shrink-0 font-semibold whitespace-nowrap">
                    Ta ocena
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="text-[0.9375rem] leading-[1.5333]">
          {mean === null || level === null
            ? `Wynik to średnia ocen cząstkowych z ${count} kryteriów. Pojawi się po ocenie wszystkich.`
            : `Średnia ${formatScore(mean)} z ${count} kryteriów daje poziom ${level}. Ocena jest ${
                outcome === 'negative' ? 'negatywna' : 'pozytywna'
              }.`}
        </p>
        {regulation.negativePoints !== null ? (
          <p className="text-ink-muted text-sm leading-[1.4286]">
            Jedna ocena {regulation.negativePoints} oznacza ocenę negatywną (
            {regulation.outcomeBasis}).
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function RecentEvents({ data }: { data: CaseData }) {
  const recent = data.view.events.slice(-RECENT_EVENTS).reverse();
  return (
    <Section title="Ostatnie zdarzenia" titleLevel={3}>
      <div className="flex flex-col gap-3">
        {recent.length === 0 ? (
          <p className="text-[0.9375rem]">Brak zdarzeń.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recent.map((event) => (
              <li key={event.id} className="border-rule flex flex-col gap-0.5 border-b pb-2.5">
                <span className="font-heading text-ink-muted text-sm leading-[normal] font-semibold">
                  {formatDate(event.occurredOn)}
                </span>
                <span className="text-[0.9375rem] leading-[normal]">{eventLabel(event.kind)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={routes.evaluationJournal(data.view.id)}
          className="font-heading text-link self-start text-[0.9375rem] leading-[normal] font-medium underline"
        >
          Cały dziennik
        </Link>
      </div>
    </Section>
  );
}

function Downloads({ data }: { data: CaseData }) {
  return (
    <Section title="Do pobrania" titleLevel={3}>
      <ul className="flex flex-col gap-3">
        {downloads.map((item) => (
          <li key={item.kind}>
            {/* A plain link: a file download, not a page of the app. */}
            <a
              href={routes.evaluationExport(data.view.id, item.kind)}
              className="font-heading text-link flex items-center gap-2 text-[0.9375rem] leading-[normal] font-medium underline"
            >
              <Download className="size-4 shrink-0" aria-hidden />
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Side band of a case: how the score is computed, the latest journal entries and downloads. */
export function CaseSide({ data }: { data: CaseData }) {
  return (
    <aside
      aria-label="Informacje o sprawie"
      className="bg-band border-rule border-t lg:w-[18.5rem] lg:shrink-0 lg:border-t-0 lg:border-l"
    >
      <ScoreExplanation data={data} />
      <RecentEvents data={data} />
      <Downloads data={data} />
    </aside>
  );
}
