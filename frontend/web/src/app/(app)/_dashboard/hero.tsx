import { StatTile } from '@sarmata/ui';
import { type DashboardData } from '@/lib/dashboard/compose-dashboard';
import { formatDate, longDate } from '@/lib/format';

/** Greeting with the headline on the left and the 2 by 2 grid of numbers on the right. */
export function Hero({ data }: { data: DashboardData }) {
  const { summary } = data;
  const nearestHint = !summary.nearestDueOn
    ? 'Brak terminów'
    : summary.nearestDueOn < data.today
      ? `Najstarszy zaległy termin ${formatDate(summary.nearestDueOn)}`
      : `Najbliższy termin ${formatDate(summary.nearestDueOn)}`;

  return (
    <section
      aria-labelledby="dashboard-heading"
      className="border-rule flex flex-col border-b lg:flex-row"
    >
      <div className="flex-1 px-6 py-10 sm:px-10">
        <p className="text-ink-muted">{longDate(data.today)}</p>
        <h1
          id="dashboard-heading"
          className="font-heading mt-4 text-[2.25rem] leading-tight font-semibold tracking-tight sm:text-[2.75rem]"
        >
          Dzień dobry. <span className="block">{data.headline}</span>
        </h1>
      </div>
      <div className="border-rule grid grid-cols-1 border-t sm:grid-cols-2 lg:w-[40rem] lg:shrink-0 lg:border-t-0 lg:border-l [&>*]:border-rule [&>*:nth-child(n+2)]:border-t sm:[&>*:nth-child(2)]:border-t-0 sm:[&>*:nth-child(even)]:border-l">
        <StatTile label="Do zrobienia" value={String(summary.todo)} hint={nearestHint} emphasis />
        <StatTile
          label="Po terminie"
          value={String(summary.overdue)}
          {...(summary.overdue === 0 ? { hint: 'Wszystko na czas' } : {})}
        />
        <StatTile
          label="Czekają na innych"
          value={String(summary.waiting)}
          hint="Sprzeciw albo kadry"
        />
        <StatTile label="Zamknięte oceny" value={String(summary.closed)} />
      </div>
    </section>
  );
}
