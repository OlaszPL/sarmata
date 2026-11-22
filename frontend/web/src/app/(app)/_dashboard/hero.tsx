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
        <p className="text-ink-muted leading-[normal]">{longDate(data.today)}</p>
        <h1
          id="dashboard-heading"
          className="font-heading mt-3 text-[2.25rem] leading-[1.1136] font-semibold tracking-[-0.0182em] sm:text-[2.5rem]"
        >
          Dzień dobry. <span className="block">{data.headline}</span>
        </h1>
      </div>
      {/* The grid lines take 1px of the padding next to them, so the block stays 284px high as in the mockup. */}
      <div className="border-rule grid grid-cols-1 border-t sm:grid-cols-2 lg:w-[34rem] lg:shrink-0 lg:border-t-0 lg:border-l">
        <StatTile label="Do zrobienia" value={String(summary.todo)} hint={nearestHint} emphasis />
        <StatTile
          label="Po terminie"
          value={String(summary.overdue)}
          {...(summary.overdue === 0 ? { hint: 'Wszystko na czas' } : {})}
          className="border-rule border-t pt-[1.1875rem] sm:border-t-0 sm:border-l sm:pt-5"
        />
        <StatTile
          label="Czeka na osobę ocenianą"
          value={String(summary.awaitingEmployee)}
          hint="Zapoznanie z oceną"
          className="border-rule border-t py-[1.1875rem]"
        />
        <StatTile
          label={`Zamknięte w ${data.today.slice(0, 4)} r.`}
          value={String(summary.closedThisYear)}
          className="border-rule border-t py-[1.1875rem] sm:border-l"
        />
      </div>
    </section>
  );
}
