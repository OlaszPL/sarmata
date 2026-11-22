import { DataTable } from '@sarmata/ui';

interface Bar {
  label: string;
  value: number;
  display: string;
  compare?: { value: number; display: string };
}

interface BarChartProps {
  caption: string;
  bars: readonly Bar[];
  /** The value that fills the whole track. */
  max: number;
}

const percentOfMax = (value: number, max: number): string =>
  `${max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0}%`;

/** Bars are decoration for sighted users, the table next to them carries every number. */
export function BarChart({ caption, bars, max }: BarChartProps) {
  const hasCompare = bars.some((bar) => bar.compare !== undefined);
  return (
    <figure className="m-0 grid gap-8 lg:grid-cols-2">
      <div aria-hidden="true" className="flex flex-col gap-4">
        {hasCompare ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
            <span className="flex items-center gap-2">
              <span className="bg-navy inline-block h-4 w-6" />
              Urząd
            </span>
            <span className="flex items-center gap-2">
              <span className="border-navy inline-block h-4 w-6 border-2 bg-white" />
              Kraj
            </span>
          </div>
        ) : null}
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="font-heading mb-1 text-[0.9375rem] font-semibold">{bar.label}</div>
            <div className="flex flex-col gap-1">
              <div className="bg-band h-5">
                <div className="bg-navy h-full" style={{ width: percentOfMax(bar.value, max) }} />
              </div>
              {bar.compare ? (
                <div className="bg-band h-5">
                  <div
                    className="border-navy h-full border-2 bg-white"
                    style={{ width: percentOfMax(bar.compare.value, max) }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <DataTable
        caption={caption}
        captionVisible
        rows={bars}
        rowKey={(bar) => bar.label}
        columns={[
          { key: 'label', header: 'Poziom', rowHeader: true, cell: (bar) => bar.label },
          { key: 'value', header: 'Urząd', cell: (bar) => bar.display },
          ...(hasCompare
            ? [
                {
                  key: 'compare',
                  header: 'Kraj',
                  cell: (bar: Bar) => bar.compare?.display ?? 'Brak',
                },
              ]
            : []),
        ]}
      />
    </figure>
  );
}
