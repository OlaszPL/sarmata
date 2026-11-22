import { type ReactNode, useId } from 'react';
import { cn } from 'cn';

interface SectionProps {
  title: ReactNode;
  /** 2 for a part of the page (30px), 3 for a compact panel such as the side band (20px). */
  titleLevel?: 2 | 3 | undefined;
  /** Links or buttons on the right of the title, e.g. "Zapisano o 14:32". */
  actions?: ReactNode | undefined;
  /** `band` paints the panel in the band color, as the side panels of the case. */
  tone?: 'plain' | 'band' | undefined;
  /** Children go edge to edge, for rows that draw their own lines and padding. */
  flush?: boolean | undefined;
  id?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** A titled block closed by a 1px line. The title names the region for screen readers. */
export function Section({
  title,
  titleLevel = 2,
  actions,
  tone = 'plain',
  flush = false,
  id,
  className,
  children,
}: SectionProps) {
  const generated = useId();
  const headingId = `${id ?? generated}-heading`;
  const Heading = titleLevel === 2 ? 'h2' : 'h3';
  const compact = titleLevel === 3;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('border-rule border-b', tone === 'band' ? 'bg-band' : null, className)}
    >
      <div
        className={cn(
          'flex flex-wrap items-end justify-between gap-x-6 gap-y-2',
          compact ? 'px-6 pt-[1.375rem]' : 'px-6 pt-6 pb-5 sm:px-8',
          compact && !flush ? 'pb-3' : null,
          compact && flush ? 'pb-[1.375rem]' : null,
          !compact && flush ? 'border-rule border-b' : null,
        )}
      >
        <Heading
          id={headingId}
          className={cn(
            'text-ink leading-[normal] font-semibold',
            compact ? 'text-xl' : 'text-[1.875rem] tracking-[-0.0133em]',
          )}
        >
          {title}
        </Heading>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {flush ? (
        children
      ) : (
        <div className={compact ? 'px-6 pb-[1.375rem]' : 'px-6 pb-8 sm:px-8'}>{children}</div>
      )}
    </section>
  );
}
