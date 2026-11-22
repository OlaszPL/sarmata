import type { ReactNode } from 'react';
import { cn } from 'cn';

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Width or alignment classes of the column, e.g. `w-[8rem] text-right`. */
  className?: string | undefined;
  /** The column that names the row: rendered as `<th scope="row">`. */
  rowHeader?: boolean | undefined;
}

interface DataTableProps<Row> {
  /** Required: names the table for screen readers. */
  caption: string;
  /** Shows the caption above the table instead of hiding it. */
  captionVisible?: boolean | undefined;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Shown in place of the table when there are no rows. */
  empty?: ReactNode | undefined;
  className?: string | undefined;
}

/** Table in the dashboard style: a 2px line over the header, 1px lines between rows, sideways scroll. */
export function DataTable<Row>({
  caption,
  captionVisible = false,
  columns,
  rows,
  rowKey,
  empty,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty !== undefined) return <>{empty}</>;

  return (
    // Side padding keeps the focus ring of the first column inside the scrolling box.
    <div className={cn('focus-inset -mx-2 overflow-x-auto px-2', className)}>
      <table className="w-full border-collapse text-left text-[0.9375rem] leading-[normal]">
        <caption
          className={
            captionVisible
              ? 'font-heading mb-3 text-left text-[1.375rem] leading-[normal] font-semibold'
              : 'sr-only'
          }
        >
          {caption}
        </caption>
        <thead>
          <tr className="border-rule font-heading border-t-2 border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('py-2.5 pr-4 font-semibold last:pr-0', column.className)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-rule border-b">
              {columns.map((column) =>
                column.rowHeader ? (
                  <th
                    key={column.key}
                    scope="row"
                    className={cn('py-2.5 pr-4 font-normal last:pr-0', column.className)}
                  >
                    {column.cell(row)}
                  </th>
                ) : (
                  <td key={column.key} className={cn('py-2.5 pr-4 last:pr-0', column.className)}>
                    {column.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
