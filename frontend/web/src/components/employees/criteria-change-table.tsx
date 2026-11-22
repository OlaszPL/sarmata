import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { DataTable, type DataTableColumn, Section } from '@sarmata/ui';
import { type CriteriaChange } from '@/lib/employees/history';

type CriteriaRow = CriteriaChange['rows'][number];

function ChangeCell({ change }: { change: CriteriaRow['change'] }) {
  if (change === null) return <span className="text-ink-muted">brak porównania</span>;
  if (change.kind === 'down') {
    return (
      <span className="text-error inline-flex items-center gap-1.5 font-semibold whitespace-nowrap">
        <ArrowDownRight className="size-4 shrink-0" aria-hidden />
        spadek o {change.by}
      </span>
    );
  }
  if (change.kind === 'up') {
    return (
      <span className="text-ink inline-flex items-center gap-1.5 font-semibold whitespace-nowrap">
        <ArrowUpRight className="size-4 shrink-0" aria-hidden />
        wzrost o {change.by}
      </span>
    );
  }
  return (
    <span className="text-ink-muted inline-flex items-center gap-1.5 whitespace-nowrap">
      <ArrowRight className="size-4 shrink-0" aria-hidden />
      bez zmian
    </span>
  );
}

/**
 * How every partial rating moved between the finished evaluations, the newest column in bold and
 * the change against the one before. Renders nothing without evaluations that carry ratings.
 */
export function CriteriaChangeTable({ criteria }: { criteria: CriteriaChange }) {
  if (criteria.columns.length === 0 || criteria.rows.length === 0) return null;
  const lastIndex = criteria.columns.length - 1;

  const columns: DataTableColumn<CriteriaRow>[] = [
    {
      key: 'criterion',
      header: 'Kryterium',
      rowHeader: true,
      className: 'min-w-[14rem] font-semibold',
      cell: (row) => row.name,
    },
    ...criteria.columns.map((column, index): DataTableColumn<CriteriaRow> => ({
      key: column.key,
      header: column.period.replace(/^Ocena /, ''),
      className: 'w-[6rem] whitespace-nowrap',
      cell: (row) => {
        const value = row.values[index];
        if (value === null || value === undefined)
          return <span className="text-ink-muted">brak</span>;
        // The newest evaluation stands out, as in the mockup.
        return index === lastIndex ? <span className="font-bold">{value}</span> : value;
      },
    })),
    {
      key: 'change',
      header: 'Zmiana',
      className: 'w-[8.125rem]',
      cell: (row) => <ChangeCell change={row.change} />,
    },
  ];

  return (
    <Section title="Zmiana w kryteriach">
      <DataTable
        caption="Oceny cząstkowe w kolejnych ocenach"
        columns={columns}
        rows={criteria.rows}
        rowKey={(row) => row.criterionId}
      />
    </Section>
  );
}
