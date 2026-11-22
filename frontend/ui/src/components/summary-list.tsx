import type { ElementType, ReactNode } from 'react';
import { cn } from 'cn';

export interface SummaryRow {
  key: string;
  value: ReactNode;
  /** Where "Zmień" goes. No link when left out. */
  changeHref?: string | undefined;
}

interface SummaryListProps {
  rows: readonly SummaryRow[];
  /** Link element for "Zmień", e.g. Next.js `Link`. A plain `<a>` by default. */
  linkAs?: ElementType | undefined;
  className?: string | undefined;
}

/** "Check your answers" list from GOV.UK: key, value and a "Zmień" link per row. */
export function SummaryList({ rows, linkAs: LinkTag = 'a', className }: SummaryListProps) {
  return (
    <dl className={cn('border-rule border-t', className)}>
      {rows.map((row) => (
        <div
          key={row.key}
          className="border-rule grid gap-x-6 gap-y-1 border-b py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
        >
          <dt className="font-heading leading-[1.4] font-semibold">{row.key}</dt>
          <dd className="leading-[1.5] break-words">{row.value}</dd>
          <dd className="sm:text-right">
            {row.changeHref ? (
              <LinkTag
                href={row.changeHref}
                className="font-heading text-link leading-[normal] font-medium underline"
              >
                Zmień<span className="sr-only"> {row.key.toLowerCase()}</span>
              </LinkTag>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
